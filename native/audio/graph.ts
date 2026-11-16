// Audio graph pieces of the app's engine (the native counterpart of the web's
// composition-playback-runtime.ts): the shared AudioContext, per-engine decoded resources and
// disposable playback generations.
import {
  AudioContext,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type AudioNode,
  type ChannelMergerNode,
  type ChannelSplitterNode,
  type GainNode,
} from "react-native-audio-api";

import {
  stereoBalance,
  type PlaybackEvent,
} from "../../src/features/composition/composition-playback-timeline.ts";
import {
  sampleUrls,
  type InstrumentDefinition,
} from "../../src/features/composition/instrument-catalog.ts";
import {
  base64ToBytes,
  closestSample,
  clockIntervalMs,
  releaseSeconds,
  resolveUrl,
  type PlaybackSchedule,
} from "./logic.ts";

let shared: AudioContext | null = null;

/** The one output context of the app (like Tone's global context). */
export function audioContext(): AudioContext {
  return (shared ??= new AudioContext());
}

/** The output context, resumed (it is suspended while the app is in the background). */
export async function runningContext(): Promise<AudioContext> {
  const context = audioContext();
  if (context.state !== "running") await context.resume();
  return context;
}

/** Suspends the output while nothing can play (app in the background). */
export function suspendContext(): void {
  if (shared?.state === "running") void shared.suspend().catch(() => {});
}

export type SampleBank = { pitches: number[]; buffers: Map<number, AudioBuffer> };

/** Scope-owned decoded resources: instrument samples and media, decoded once per engine. */
export class PlaybackResources {
  private disposed = false;
  private media = new Map<string, Promise<AudioBuffer>>();
  private samples = new Map<string, Promise<SampleBank>>();

  constructor(private readonly origin: string) {}

  buffer(url: string): Promise<AudioBuffer> {
    const absolute = resolveUrl(this.origin, url);
    const cached = this.media.get(absolute);
    if (cached) return cached;
    const loading = fetch(absolute).then(async (response) => {
      if (!response.ok) throw new Error(`Audio request failed (${response.status}): ${url}`);
      return audioContext().decodeAudioData(await response.arrayBuffer());
    });
    this.media.set(absolute, loading);
    void loading.catch(() => {
      if (this.media.get(absolute) === loading) this.media.delete(absolute);
    });
    return loading;
  }

  instruments(instrument: InstrumentDefinition): Promise<SampleBank> {
    const cached = this.samples.get(instrument.id);
    if (cached) return cached;
    const loading = Promise.all(
      Object.entries(sampleUrls(instrument)).map(
        async ([pitch, filename]) =>
          [
            Number(pitch),
            await this.buffer(`/audio/instruments/${instrument.id}/${filename}`),
          ] as const,
      ),
    ).then((entries) => {
      if (this.disposed) throw new Error("Playback scope was disposed.");
      return { pitches: entries.map(([pitch]) => pitch), buffers: new Map(entries) };
    });
    this.samples.set(instrument.id, loading);
    void loading.catch(() => {
      if (this.samples.get(instrument.id) === loading) this.samples.delete(instrument.id);
    });
    return loading;
  }

  dispose(): void {
    this.disposed = true;
    this.samples.clear();
    this.media.clear();
  }
}

/** Decodes an audio file that crossed the bridge. */
export function decodeFile(base64: string): Promise<AudioBuffer> {
  return audioContext().decodeAudioData(base64ToBytes(base64).buffer);
}

type BalanceChain = {
  input: GainNode;
  splitter: ChannelSplitterNode;
  left: GainNode;
  right: GainNode;
  merger: ChannelMergerNode;
};
type Voice = { source: AudioBufferSourceNode; gain: GainNode; level: number };

/** A permanently disposable output graph: a cancelled generation can never become audible again. */
export class PlaybackGeneration {
  readonly context = audioContext();
  readonly output: GainNode;
  private readonly tracks = new Map<number, BalanceChain>();
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly banks = new Map<number, SampleBank>();
  private readonly voices = new Map<string, Voice>();
  private active = true;
  private clock: ReturnType<typeof setInterval> | undefined;
  private reporter: ReturnType<typeof setInterval> | undefined;

  constructor(master: GainNode) {
    this.output = this.context.createGain();
    this.output.connect(master);
  }

  /** The track's stereo-balance input, created on first use; updates its level and pan. */
  track(trackId: number, volume: number, pan: number | undefined): GainNode {
    let chain = this.tracks.get(trackId);
    if (!chain) {
      const input = this.context.createGain();
      input.channelCount = 2;
      input.channelCountMode = "explicit";
      input.channelInterpretation = "speakers";
      const splitter = this.context.createChannelSplitter(2);
      const left = this.context.createGain();
      const right = this.context.createGain();
      const merger = this.context.createChannelMerger(2);
      input.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(this.output);
      chain = { input, splitter, left, right, merger };
      this.tracks.set(trackId, chain);
    }
    const balance = stereoBalance(volume, pan);
    chain.left.gain.value = balance.left;
    chain.right.gain.value = balance.right;
    return chain.input;
  }

  /** Updates an existing track's level and pan. */
  retune(trackId: number, volume: number, pan: number | undefined): void {
    if (this.tracks.has(trackId)) this.track(trackId, volume, pan);
  }

  instrument(trackId: number, bank: SampleBank): void {
    this.banks.set(trackId, bank);
  }

  /** Starts a sampler voice (nearest sample, pitch-shifted, gain = velocity). */
  attack(event: PlaybackEvent, time: number): void {
    if (!this.active) return;
    const bank = this.banks.get(event.trackId);
    const output = this.tracks.get(event.trackId)?.input;
    const choice = bank && closestSample(bank.pitches, event.pitch);
    const buffer = choice && bank.buffers.get(choice.sample);
    if (!output || !choice || !buffer) return;
    const level = event.velocity / 127;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.connect(output);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = choice.playbackRate;
    source.connect(gain);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.sources.delete(source);
      if (this.voices.get(event.voiceId)?.source === source) this.voices.delete(event.voiceId);
    };
    source.start(time);
    this.voices.set(event.voiceId, { source, gain, level });
  }

  /** Fades a voice out over the sampler release. */
  release(event: PlaybackEvent, time: number): void {
    const voice = this.voices.get(event.voiceId);
    if (!voice) return;
    this.voices.delete(event.voiceId);
    voice.gain.gain.setValueAtTime(voice.level, time);
    voice.gain.gain.linearRampToValueAtTime(0, time + releaseSeconds);
    voice.source.stop(time + releaseSeconds);
  }

  audio(
    buffer: AudioBuffer,
    output: AudioNode,
    when: number,
    offset: number,
    duration: number,
  ): void {
    if (!this.active || duration <= 0) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
    };
    source.start(Math.max(0, when), offset, duration);
  }

  /**
   * Runs `schedule` on a JS clock: attacks, releases and clicks are scheduled ahead on the audio
   * clock; `ended` runs once the end is reached; `report` runs every `reportMs` while active.
   */
  run(
    schedule: PlaybackSchedule,
    options: {
      metronome?: () => boolean;
      click?: AudioBuffer;
      ended: () => void;
      report?: () => void;
      reportMs?: number;
    },
  ): void {
    this.output.gain.setValueAtTime(0, schedule.endAt);
    const tick = () => {
      if (!this.active) return;
      for (const action of schedule.tick(
        this.context.currentTime,
        options.metronome?.() ?? false,
      )) {
        if (action.type === "end") {
          options.ended();
          return;
        }
        if (action.type === "attack") this.attack(action.event, action.at);
        else if (action.type === "release") this.release(action.event, action.at);
        else if (options.click)
          this.audio(options.click, this.output, action.at, 0, options.click.duration);
      }
    };
    tick();
    this.clock = setInterval(tick, clockIntervalMs);
    const { report, reportMs } = options;
    if (report && reportMs)
      this.reporter = setInterval(() => {
        if (this.active) report();
      }, reportMs);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.clock);
    clearInterval(this.reporter);
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(0, now);
    this.output.disconnect();
    for (const source of this.sources) {
      source.onended = null;
      source.stop(now);
      source.disconnect();
    }
    this.sources.clear();
    for (const voice of this.voices.values()) voice.gain.disconnect();
    this.voices.clear();
    this.banks.clear();
    for (const chain of this.tracks.values()) {
      chain.input.disconnect();
      chain.splitter.disconnect();
      chain.left.disconnect();
      chain.right.disconnect();
      chain.merger.disconnect();
    }
    this.tracks.clear();
  }
}

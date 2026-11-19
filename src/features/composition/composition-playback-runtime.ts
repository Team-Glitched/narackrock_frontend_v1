import * as Tone from "tone";
import { sampleUrls, type InstrumentDefinition } from "./instrument-catalog";
import { stereoBalance, type PlaybackEvent } from "./composition-playback-timeline";

type SampleBank = Record<string, AudioBuffer>;

/** Scope-owned decoded resources. Playback nodes never live in this cache. */
export class PlaybackResources {
  private disposed = false;
  private media = new Map<string, Promise<AudioBuffer>>();
  private samples = new Map<string, Promise<SampleBank>>();
  private files = new WeakMap<File, Promise<AudioBuffer>>();

  buffer(url: string): Promise<AudioBuffer> {
    const cached = this.media.get(url);
    if (cached) return cached;
    const loading = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Audio request failed (${response.status}): ${url}`);
      return Tone.getContext().rawContext.decodeAudioData(await response.arrayBuffer());
    });
    this.media.set(url, loading);
    void loading.catch(() => {
      if (this.media.get(url) === loading) this.media.delete(url);
    });
    return loading;
  }

  file(file: File): Promise<AudioBuffer> {
    const cached = this.files.get(file);
    if (cached) return cached;
    const loading = file.arrayBuffer().then((bytes) => Tone.getContext().rawContext.decodeAudioData(bytes));
    this.files.set(file, loading);
    void loading.catch(() => this.files.delete(file));
    return loading;
  }

  instruments(instrument: InstrumentDefinition): Promise<SampleBank> {
    const cached = this.samples.get(instrument.id);
    if (cached) return cached;
    const loading = Promise.all(Object.entries(sampleUrls(instrument)).map(async ([pitch, filename]) =>
      [pitch, await this.buffer(`/audio/instruments/${instrument.id}/${filename}`)] as const,
    )).then((entries) => {
      if (this.disposed) throw new Error("Playback scope was disposed.");
      return Object.fromEntries(entries);
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
    this.files = new WeakMap();
  }
}

type BalanceChain = {
  input: GainNode;
  splitter: ChannelSplitterNode;
  left: GainNode;
  right: GainNode;
  merger: ChannelMergerNode;
};
type SamplerLane = { sampler: Tone.Sampler; pitches: Set<number> };
type Voice = { lane: SamplerLane; pitch: number };

/** A permanently disposable output graph: a cancelled generation can never become audible again. */
export class PlaybackGeneration {
  readonly context = Tone.getContext().rawContext;
  readonly output = this.context.createGain();
  readonly tracks = new Map<number, BalanceChain>();
  readonly sources = new Set<AudioBufferSourceNode>();
  private pools = new Map<number, { bank: SampleBank; lanes: SamplerLane[] }>();
  private voices = new Map<string, Voice>();
  private active = true;
  private clock: Tone.Clock | null = null;
  private uiTimer: number | undefined;
  epoch = 0;
  positionMs = 0;
  endMs = 0;

  constructor(master: GainNode) {
    this.output.connect(master);
  }

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

  instrument(trackId: number, bank: SampleBank): void {
    this.pools.set(trackId, { bank, lanes: [] });
  }

  attack(event: PlaybackEvent, time: number): void {
    if (!this.active) return;
    const pool = this.pools.get(event.trackId);
    const output = this.tracks.get(event.trackId)?.input;
    if (!pool || !output) return;
    let lane = pool.lanes.find((candidate) => !candidate.pitches.has(event.pitch));
    if (!lane) {
      lane = { sampler: new Tone.Sampler({ urls: pool.bank, release: 0.08 }).connect(output), pitches: new Set() };
      pool.lanes.push(lane);
    }
    lane.pitches.add(event.pitch);
    this.voices.set(event.voiceId, { lane, pitch: event.pitch });
    lane.sampler.triggerAttack(Tone.Frequency(event.pitch, "midi").toNote(), time, event.velocity / 127);
  }

  release(event: PlaybackEvent, time: number): void {
    const voice = this.voices.get(event.voiceId);
    if (!voice) return;
    voice.lane.sampler.triggerRelease(Tone.Frequency(voice.pitch, "midi").toNote(), time);
    voice.lane.pitches.delete(voice.pitch);
    this.voices.delete(event.voiceId);
  }

  audio(buffer: AudioBuffer, output: AudioNode, when: number, offset: number, duration: number): void {
    if (!this.active || duration <= 0) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
    };
    source.start(when, offset, duration);
  }

  startClock(callback: (time: number) => void, update?: () => void): void {
    this.clock = new Tone.Clock((time) => {
      if (this.active) callback(time);
    }, 100);
    this.clock.start(this.epoch);
    if (update) {
      const frame = () => {
        if (!this.active) return;
        update();
        if (this.active) this.uiTimer = window.requestAnimationFrame(frame);
      };
      this.uiTimer = window.requestAnimationFrame(frame);
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(0, now);
    this.output.disconnect();
    this.clock?.dispose();
    this.clock = null;
    if (this.uiTimer !== undefined) window.cancelAnimationFrame(this.uiTimer);
    this.uiTimer = undefined;
    for (const source of this.sources) {
      source.onended = null;
      source.stop(now);
      source.disconnect();
    }
    this.sources.clear();
    for (const pool of this.pools.values()) for (const { sampler } of pool.lanes) {
      sampler.releaseAll(now);
      sampler.dispose();
    }
    this.voices.clear();
    this.pools.clear();
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

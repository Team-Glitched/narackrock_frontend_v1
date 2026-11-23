// The app's audio engines: one per web `useCompositionPlayback` scope, keyed by the id the web
// sends with every `audio-engine` command. Same rules as the web hook
// (src/features/composition/use-composition-playback.ts); transport reports go to the web as
// `narackrock:audio-state` and to native screens through `useNativeAudioState`.
import { AppState } from "react-native";
import type { AudioBuffer, GainNode } from "react-native-audio-api";

import type {
  NativeAudioCommand,
  NativeAudioComposition,
  NativeAudioMix,
  NativeAudioState,
} from "../../src/lib/native-bridge-protocol";
import {
  audioPlaybackWindow,
  buildPlaybackEvents,
  playbackEndMs,
  type PlaybackEvent,
} from "../../src/features/composition/composition-playback-timeline.ts";
import { findInstrument } from "../../src/features/composition/instrument-catalog.ts";
import { partLabel } from "../../src/features/composition/instrument-parts.ts";
import { signatureTiming } from "../../src/features/composition/time-signature.ts";
import {
  audioContext,
  decodeFile,
  PlaybackGeneration,
  PlaybackResources,
  runningContext,
  suspendContext,
} from "./graph.ts";
import {
  audibleTracks,
  auditionWindow,
  clickSamples,
  masterGain,
  PlaybackSchedule,
  reportIntervalMs,
  trackLevel,
} from "./logic.ts";

export type Transport = { playing: boolean; positionMs: number };

const idle: Transport = { playing: false, positionMs: 0 };

/** Errors reach the web as the rejection message, which the hook shows like its own errors. */
function failure(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("오디오를 재생하지 못했습니다.");
}

class Engine {
  private composition: NativeAudioComposition | null = null;
  private durationMs: number | undefined;
  private mix: NativeAudioMix = {
    muted: false,
    trackVolumes: {},
    mutedTrackIds: [],
    metronome: false,
  };
  private readonly resources: PlaybackResources;
  private master: GainNode | null = null;
  private main: { generation: PlaybackGeneration; schedule: PlaybackSchedule } | null = null;
  private preview: PlaybackGeneration | null = null;
  private mainRequest = 0;
  private previewRequest = 0;
  private positionMs = 0;
  private disposed = false;

  constructor(
    readonly id: string,
    origin: string,
    private readonly emit: (state: NativeAudioState) => void,
  ) {
    this.resources = new PlaybackResources(origin);
  }

  transport(): Transport {
    const main = this.main;
    return main
      ? { playing: true, positionMs: main.schedule.position(main.generation.context.currentTime) }
      : { playing: false, positionMs: this.positionMs };
  }

  async run(command: NativeAudioCommand): Promise<void> {
    switch (command.type) {
      case "load":
        this.pause("if-playing");
        this.stopPreview();
        this.composition = command.composition;
        this.durationMs = command.durationMs ?? undefined;
        return;
      case "mix":
        this.mix = command.mix;
        this.applyMix();
        return;
      case "play":
        return this.play(command.positionMs);
      case "pause":
        this.pause("always");
        return;
      case "seek": {
        this.pause("silent");
        const end = this.composition ? playbackEndMs(this.composition, this.durationMs) : Infinity;
        this.positionMs = Math.max(0, Math.min(end, command.positionMs));
        this.report(false);
        return;
      }
      case "preview-notes":
        return this.previewNotes(
          command.instrumentId,
          command.pitches,
          command.spacingMs,
          command.durationMs,
        );
      case "preview-audio":
        return this.previewAudio(command.audio.base64, command.startMs, command.endMs);
      case "stop-preview":
        this.stopPreview();
        return;
      case "dispose":
        this.dispose();
        return;
    }
  }

  /**
   * Stops playback where it is. Reports `always` (the web's pause), `if-playing` (playback stopped
   * for another reason) or stays `silent` (the caller reports the new state itself).
   */
  pause(report: "always" | "if-playing" | "silent"): void {
    this.mainRequest++;
    const main = this.main;
    if (main) {
      this.positionMs = main.schedule.position(main.generation.context.currentTime);
      main.generation.stop();
      this.main = null;
    }
    if (report === "always" || (report === "if-playing" && main)) this.report(false);
  }

  stopPreview(): void {
    this.previewRequest++;
    this.preview?.stop();
    this.preview = null;
  }

  dispose(): void {
    this.pause("silent");
    this.stopPreview();
    this.disposed = true;
    this.resources.dispose();
    this.master?.disconnect();
    this.master = null;
  }

  private report(ended: boolean): void {
    this.emit({ engine: this.id, ...this.transport(), ended });
  }

  private output(): GainNode {
    if (!this.master) {
      const context = audioContext();
      this.master = context.createGain();
      this.master.connect(context.destination);
    }
    this.master.gain.value = masterGain(this.mix);
    return this.master;
  }

  private applyMix(): void {
    if (this.master) this.master.gain.value = masterGain(this.mix);
    const tracks = this.composition?.tracks ?? [];
    for (const track of tracks)
      this.main?.generation.retune(track.trackId, trackLevel(tracks, track, this.mix), track.pan);
  }

  private async play(requestedMs: number): Promise<void> {
    const input = this.composition;
    if (!input || this.disposed) return;
    this.pause("silent");
    this.stopPreview();
    const request = ++this.mainRequest;
    const live = () => !this.disposed && request === this.mainRequest;
    const endMs = playbackEndMs(input, this.durationMs);
    if (endMs <= 0) return;
    const position = requestedMs >= endMs ? 0 : Math.max(0, requestedMs);
    let generation: PlaybackGeneration | null = null;
    try {
      const context = await runningContext();
      if (!live()) return;
      const entries = await Promise.all(
        audibleTracks(input.tracks).map(async (track) => {
          const hasMidi = track.clips.some(
            (clip) => clip.clipType === "MIDI" && clip.midiNotes?.length,
          );
          const instrument = hasMidi ? findInstrument(track.instrument) : undefined;
          if (hasMidi && !instrument)
            throw new Error(
              `${track.name}: ${partLabel(track.instrument)} 소리는 재생할 수 없습니다.`,
            );
          const [bank, audio] = await Promise.all([
            instrument ? this.resources.instruments(instrument) : undefined,
            Promise.all(
              track.clips
                .filter((clip) => clip.clipType === "AUDIO")
                .map(async (clip) => {
                  if (!clip.mediaUrl)
                    throw new Error(`${track.name}: 오디오 파일 주소가 없습니다.`);
                  return { clip, buffer: await this.resources.buffer(clip.mediaUrl) };
                }),
            ),
          ]);
          return { track, bank, audio };
        }),
      );
      if (!live()) return;
      generation = new PlaybackGeneration(this.output());
      const epoch = context.currentTime + 0.05;
      const { beatMs } = signatureTiming(
        {
          numerator: input.project.timeSignatureNumerator ?? 4,
          denominator: input.project.timeSignatureDenominator ?? 4,
        },
        input.project.bpm,
      );
      const schedule = new PlaybackSchedule(
        buildPlaybackEvents(input, position, endMs),
        epoch,
        position,
        endMs,
        beatMs,
      );
      for (const { track, bank, audio } of entries) {
        const output = generation.track(
          track.trackId,
          trackLevel(input.tracks, track, this.mix),
          track.pan,
        );
        if (bank) generation.instrument(track.trackId, bank);
        for (const { clip, buffer } of audio) {
          const window = audioPlaybackWindow(clip, position, buffer.duration);
          if (!window) continue;
          const duration = Math.min(
            window.durationSeconds,
            (endMs - position) / 1000 - window.delaySeconds,
          );
          generation.audio(
            buffer,
            output,
            epoch + window.delaySeconds,
            window.offsetSeconds,
            duration,
          );
        }
      }
      const started = generation;
      this.main = { generation: started, schedule };
      this.positionMs = position;
      started.run(schedule, {
        metronome: () => this.mix.metronome,
        click: clickBuffer(context.sampleRate),
        ended: () => {
          if (!live()) return;
          started.stop();
          this.main = null;
          this.mainRequest++;
          this.positionMs = endMs;
          this.report(true);
        },
        report: () => {
          if (live()) this.report(false);
        },
        reportMs: reportIntervalMs,
      });
      this.report(false);
    } catch (cause) {
      if (!live()) return;
      generation?.stop();
      this.main = null;
      throw failure(cause);
    }
  }

  private async previewNotes(
    instrumentId: string,
    pitches: number[],
    spacingMs: number,
    durationMs: number,
  ): Promise<void> {
    this.stopPreview();
    const request = ++this.previewRequest;
    const live = () => !this.disposed && request === this.previewRequest;
    try {
      const instrument = findInstrument(instrumentId);
      if (!instrument) throw new Error(`${partLabel(instrumentId)} 소리는 재생할 수 없습니다.`);
      const context = await runningContext();
      if (!live()) return;
      const bank = await this.resources.instruments(instrument);
      if (!live()) return;
      const generation = new PlaybackGeneration(this.output());
      this.preview = generation;
      generation.track(0, 100, 0);
      generation.instrument(0, bank);
      const events: PlaybackEvent[] = pitches.flatMap((pitch, index) => {
        const base = { trackId: 0, voiceId: String(index), pitch, velocity: 102 };
        return [
          { ...base, type: "attack" as const, atMs: index * spacingMs },
          { ...base, type: "release" as const, atMs: index * spacingMs + durationMs },
        ];
      });
      const endMs = (pitches.length - 1) * spacingMs + durationMs + 80;
      generation.run(new PlaybackSchedule(events, context.currentTime + 0.03, 0, endMs), {
        ended: () => {
          generation.stop();
          if (this.preview === generation) this.preview = null;
        },
      });
    } catch (cause) {
      if (live()) throw failure(cause);
    }
  }

  private async previewAudio(
    base64: string,
    startMs: number | null,
    endMs: number | null,
  ): Promise<void> {
    this.pause("if-playing");
    this.stopPreview();
    const request = ++this.previewRequest;
    const live = () => !this.disposed && request === this.previewRequest;
    try {
      const context = await runningContext();
      if (!live()) return;
      const buffer = await decodeFile(base64);
      if (!live()) return;
      const { offset, duration } = auditionWindow(startMs, endMs, buffer.duration);
      const generation = new PlaybackGeneration(this.output());
      this.preview = generation;
      const epoch = context.currentTime + 0.03;
      generation.audio(buffer, generation.output, epoch, offset, duration);
      generation.run(new PlaybackSchedule([], epoch, 0, duration * 1000), {
        ended: () => {
          generation.stop();
          if (this.preview === generation) this.preview = null;
        },
      });
    } catch (cause) {
      if (live()) throw failure(cause);
    }
  }
}

let click: AudioBuffer | null = null;

/** The metronome click, built once for the shared context. */
function clickBuffer(sampleRate: number): AudioBuffer {
  if (click?.sampleRate !== sampleRate) {
    const data = clickSamples(sampleRate);
    click = audioContext().createBuffer(1, data.length, sampleRate);
    click.copyToChannel(data, 0);
  }
  return click;
}

const engines = new Map<string, Engine>();
const stateListeners = new Set<(state: NativeAudioState) => void>();
const changeListeners = new Map<string, Set<() => void>>();

function emit(state: NativeAudioState): void {
  for (const listener of stateListeners) listener(state);
  for (const listener of changeListeners.get(state.engine) ?? []) listener();
}

/** Runs one web command on engine `id` (created on first use). Rejects with the web's message. */
export async function runAudioCommand(
  origin: string,
  id: string,
  command: NativeAudioCommand,
): Promise<void> {
  let engine = engines.get(id);
  if (command.type === "dispose") {
    engines.delete(id);
    engine?.dispose();
    for (const listener of changeListeners.get(id) ?? []) listener();
    return;
  }
  if (!engine) {
    engine = new Engine(id, origin, emit);
    engines.set(id, engine);
  }
  await engine.run(command);
}

/** Every transport report (start, pause, seek, end and periodic while playing), for the web. */
export function onAudioState(listener: (state: NativeAudioState) => void): () => void {
  stateListeners.add(listener);
  return () => void stateListeners.delete(listener);
}

/** Runs `listener` whenever engine `id` reports or goes away. */
export function subscribeEngine(id: string, listener: () => void): () => void {
  let listeners = changeListeners.get(id);
  if (!listeners) changeListeners.set(id, (listeners = new Set()));
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) changeListeners.delete(id);
  };
}

/** Engine `id`'s live transport (position from the audio clock while playing). */
export function engineTransport(id: string | null): Transport {
  return (id && engines.get(id)?.transport()) || idle;
}

/** Disposes every engine (the page reloaded: its scopes are gone). */
export function disposeAudioEngines(): void {
  for (const id of [...engines.keys()]) void runAudioCommand("", id, { type: "dispose" });
}

// Leaving the foreground stops all sound, like the web hook's `onAppBackground` (the WebView may
// not run scripts in the background); the output is resumed by the next play.
AppState.addEventListener("change", (state) => {
  if (state !== "background") return;
  for (const engine of engines.values()) {
    engine.pause("if-playing");
    engine.stopPreview();
  }
  suspendContext();
});

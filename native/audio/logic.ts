// Pure parts of the app's audio engine: no react-native or audio library imports, so they run in
// Node tests (logic.test.ts) as well as in the app.
import type { TrackDto } from "../../src/lib/api/composition.ts";
import type { NativeAudioMix } from "../../src/lib/native-bridge-protocol.ts";
import {
  playbackEventIsDue,
  playbackHasEnded,
  type PlaybackEvent,
} from "../../src/features/composition/composition-playback-timeline.ts";

/** Sampler release, as the web's `Tone.Sampler({ release: 0.08 })`. */
export const releaseSeconds = 0.08;

/**
 * How far ahead the JS clock schedules on the audio clock. The web's Tone clock looks 0.1 s ahead;
 * the app's JS thread also renders native screens, so it keeps more slack against timer jitter.
 */
export const lookaheadSeconds = 0.2;

/** Interval of the JS scheduling clock (ms). */
export const clockIntervalMs = 25;

/** Interval of transport reports to the web while playing (ms): about 4 a second. */
export const reportIntervalMs = 250;

/**
 * The sample a pitch plays from and the rate that shifts it there, like Tone.Sampler: the nearest
 * sampled pitch within 96 semitones, preferring the one above on a tie. Null without samples.
 */
export function closestSample(
  samples: readonly number[],
  pitch: number,
): { sample: number; playbackRate: number } | null {
  const available = new Set(samples);
  for (let interval = 0; interval < 96; interval++) {
    if (available.has(pitch + interval))
      return { sample: pitch + interval, playbackRate: 2 ** (-interval / 12) };
    if (available.has(pitch - interval))
      return { sample: pitch - interval, playbackRate: 2 ** (interval / 12) };
  }
  return null;
}

const hasSolo = (tracks: readonly TrackDto[]) =>
  tracks.some((candidate) => candidate.isSolo && !candidate.isMuted);

/** Tracks a playback loads: not muted in the project, and soloed when any track is. */
export function audibleTracks(tracks: readonly TrackDto[]): TrackDto[] {
  const solo = hasSolo(tracks);
  return tracks.filter((track) => !track.isMuted && (!solo || track.isSolo));
}

/** A track's level (0–100) with project mute/solo, local mutes and local volumes (the web hook's). */
export function trackLevel(
  tracks: readonly TrackDto[],
  track: TrackDto,
  mix: Pick<NativeAudioMix, "trackVolumes" | "mutedTrackIds">,
): number {
  return track.isMuted ||
    mix.mutedTrackIds.includes(track.trackId) ||
    (hasSolo(tracks) && !track.isSolo)
    ? 0
    : (mix.trackVolumes[track.trackId] ?? track.volume);
}

export function masterGain(mix: Pick<NativeAudioMix, "muted">): number {
  return mix.muted ? 0 : 1;
}

/** The metronome click: 40 ms of 1 kHz sine at 0.15, fading out linearly. */
export function clickSamples(sampleRate: number): Float32Array<ArrayBuffer> {
  const data = new Float32Array(Math.ceil(sampleRate * 0.04));
  for (let i = 0; i < data.length; i++)
    data[i] = Math.sin((i * 2 * Math.PI * 1000) / sampleRate) * 0.15 * (1 - i / data.length);
  return data;
}

/** Peak absolute sample, 0–1. */
export function peak(data: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  return Math.min(1, max);
}

/** Absolute URL of a media or sample URL: relative ones belong to the app's local web server. */
export function resolveUrl(origin: string, url: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}

/** Validated audition window in seconds, like the web's `previewAudio`. */
export function auditionWindow(
  startMs: number | null,
  endMs: number | null,
  durationSeconds: number,
): { offset: number; duration: number } {
  const start = (startMs ?? 0) / 1000;
  const end = (endMs ?? durationSeconds * 1000) / 1000;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= durationSeconds ||
    end <= start ||
    end > durationSeconds + 0.1
  )
    throw new Error("선택한 오디오 구간이 올바르지 않습니다.");
  return { offset: start, duration: Math.min(end, durationSeconds) - start };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunks keep the spread argument count well within engine limits (Hermes included).
  for (let i = 0; i < bytes.length; i += 0x2000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type ScheduledAction =
  | { type: "attack" | "release"; event: PlaybackEvent; at: number }
  | { type: "click"; at: number }
  | { type: "end" };

/**
 * One playback's timeline on the audio clock: `epoch` (seconds) is where project time `positionMs`
 * sounds; the playback stops at project time `endMs`. Each clock tick returns what to schedule,
 * following the web hook's rules (composition-playback-timeline.ts).
 */
export class PlaybackSchedule {
  readonly epoch: number;
  readonly positionMs: number;
  readonly endMs: number;
  /** Metronome beat length; null for previews. */
  private readonly beatMs: number | null;
  private readonly attacks: PlaybackEvent[];
  private readonly releases: PlaybackEvent[];
  private attackIndex = 0;
  private releaseIndex = 0;
  private beat: number;
  private ended = false;

  constructor(
    events: PlaybackEvent[],
    epoch: number,
    positionMs: number,
    endMs: number,
    beatMs: number | null = null,
  ) {
    this.epoch = epoch;
    this.positionMs = positionMs;
    this.endMs = endMs;
    this.beatMs = beatMs;
    this.attacks = events.filter((event) => event.type === "attack");
    this.releases = events.filter((event) => event.type === "release");
    this.beat = beatMs ? Math.ceil(positionMs / beatMs) : 0;
  }

  /** Audio-clock seconds of project time `ms`. */
  at(ms: number): number {
    return this.epoch + (ms - this.positionMs) / 1000;
  }

  get endAt(): number {
    return this.epoch + Math.max(0, this.endMs - this.positionMs) / 1000;
  }

  /** Project time (ms) sounding at audio-clock time `raw`. */
  position(raw: number): number {
    return Math.max(
      this.positionMs,
      Math.min(this.endMs, this.positionMs + (raw - this.epoch) * 1000),
    );
  }

  /** What to schedule at audio-clock time `raw`; `end` once the playback is over (then nothing). */
  tick(raw: number, metronome: boolean): ScheduledAction[] {
    if (this.ended) return [];
    if (playbackHasEnded(this.epoch, this.positionMs, this.endMs, raw)) {
      this.ended = true;
      return [{ type: "end" }];
    }
    const time = raw + lookaheadSeconds;
    const actions: ScheduledAction[] = [];
    const due = (event: PlaybackEvent | undefined): event is PlaybackEvent =>
      !!event && playbackEventIsDue(event, this.epoch, this.positionMs, time, time);
    // Unlike Tone's sampler lanes, a voice here is its own source, so releases may be scheduled
    // ahead at their exact time too; pausing stops every source anyway.
    for (
      let event = this.attacks[this.attackIndex];
      due(event);
      event = this.attacks[++this.attackIndex]
    )
      actions.push({ type: "attack", event, at: Math.max(raw, this.at(event.atMs)) });
    for (
      let event = this.releases[this.releaseIndex];
      due(event);
      event = this.releases[++this.releaseIndex]
    )
      actions.push({ type: "release", event, at: Math.max(raw, this.at(event.atMs)) });
    if (this.beatMs) {
      const nextBeat = this.at(this.beat * this.beatMs);
      if (time >= nextBeat) {
        this.beat++;
        if (metronome && nextBeat < this.endAt)
          actions.push({ type: "click", at: Math.max(raw, nextBeat) });
      }
    }
    return actions;
  }
}

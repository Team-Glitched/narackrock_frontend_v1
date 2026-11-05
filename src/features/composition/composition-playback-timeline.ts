import type { ClipDto, CompositionDto } from "../../lib/api/composition.ts";
import { findInstrument } from "./instrument-catalog.ts";

export const drumTailMs = 1_450;

type PlaybackProject = {
  project: Pick<CompositionDto["project"], "bpm" | "ppq" | "maxDurationMs">;
};
type TimelineComposition = PlaybackProject & { tracks: CompositionDto["tracks"] };

export type PlaybackEvent = {
  type: "attack" | "release";
  atMs: number;
  trackId: number;
  voiceId: string;
  pitch: number;
  velocity: number;
};

export type AudioPlaybackWindow = {
  delaySeconds: number;
  offsetSeconds: number;
  durationSeconds: number;
};

export function compositionEndMs(composition: PlaybackProject, tracks: CompositionDto["tracks"]): number {
  const ticksPerMinute = composition.project.bpm * composition.project.ppq;
  let endMs = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.clipType === "AUDIO") {
        endMs = Math.max(endMs, clip.startTimeMs + clip.durationMs);
      } else {
        for (const note of clip.midiNotes ?? []) {
          endMs = Math.max(endMs, (clip.startTick + note.startTick + note.durationTick) * 60_000 / ticksPerMinute);
        }
      }
    }
  }
  return Math.min(composition.project.maxDurationMs, endMs);
}

export function playbackEndMs(composition: TimelineComposition, explicitDurationMs?: number): number {
  return explicitDurationMs === undefined
    ? compositionEndMs(composition, composition.tracks)
    : Math.max(0, Math.min(composition.project.maxDurationMs, explicitDurationMs));
}

/** Events use project milliseconds; the runtime translates them to its generation's audio epoch. */
export function buildPlaybackEvents(composition: TimelineComposition, positionMs: number, endMs: number): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  if (positionMs >= endMs) return events;
  const ticksPerMinute = composition.project.bpm * composition.project.ppq;
  composition.tracks.forEach((track, trackIndex) => {
    const drum = findInstrument(track.instrument)?.kind === "drum";
    track.clips.forEach((clip, clipIndex) => {
      if (clip.clipType !== "MIDI") return;
      (clip.midiNotes ?? []).forEach((note, noteIndex) => {
        const startTick = clip.startTick + note.startTick;
        const startMs = startTick * 60_000 / ticksPerMinute;
        const releaseMs = Math.min(endMs, drum
          ? startMs + drumTailMs
          : (startTick + note.durationTick) * 60_000 / ticksPerMinute);
        if (startMs >= endMs || releaseMs <= positionMs || (drum && startMs < positionMs)) return;
        const voice = {
          trackId: track.trackId,
          voiceId: `${trackIndex}:${clipIndex}:${noteIndex}`,
          pitch: note.pitch,
          velocity: note.velocity,
        };
        events.push({ ...voice, type: "attack", atMs: Math.max(positionMs, startMs) });
        events.push({ ...voice, type: "release", atMs: releaseMs });
      });
    });
  });
  return events.sort((a, b) => a.atMs - b.atMs || (a.type === b.type ? 0 : a.type === "release" ? -1 : 1));
}

export function audioPlaybackWindow(
  clip: ClipDto,
  positionMs: number,
  bufferDurationSeconds: number,
): AudioPlaybackWindow | null {
  if (clip.clipType !== "AUDIO") return null;
  const startMs = clip.startTimeMs;
  const elapsedMs = Math.max(0, positionMs - startMs);
  const offsetSeconds = (clip.clipOffsetMs + elapsedMs) / 1_000;
  const durationSeconds = Math.min((clip.durationMs - elapsedMs) / 1_000, bufferDurationSeconds - offsetSeconds);
  if (durationSeconds <= 0) return null;
  return {
    delaySeconds: Math.max(0, startMs - positionMs) / 1_000,
    offsetSeconds,
    durationSeconds,
  };
}

/** Stereo balance, not equal-power panning: preserve the unattenuated channel. */
export function stereoBalance(volume: number, pan = 0): { left: number; right: number } {
  const level = Math.max(0, Math.min(100, volume)) / 100;
  const balance = Math.max(-100, Math.min(100, pan));
  return {
    left: level * (balance > 0 ? 1 - balance / 100 : 1),
    right: level * (balance < 0 ? 1 + balance / 100 : 1),
  };
}

/** Lookahead may schedule attacks, but must not retire a sampler voice before its raw release time. */
export function playbackEventIsDue(
  event: PlaybackEvent,
  epochSeconds: number,
  positionMs: number,
  clockSeconds: number,
  rawSeconds: number,
): boolean {
  const targetSeconds = epochSeconds + (event.atMs - positionMs) / 1_000;
  return targetSeconds <= (event.type === "release" ? rawSeconds : clockSeconds);
}

export function playbackHasEnded(epochSeconds: number, positionMs: number, endMs: number, rawSeconds: number): boolean {
  return rawSeconds >= epochSeconds + Math.max(0, endMs - positionMs) / 1_000;
}

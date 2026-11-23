import { parseSignature, signatureTiming } from "./time-signature.ts";

const MIN_METRONOME_BPM = 20;
const MAX_METRONOME_BPM = 300;
const MAX_BEATS_PER_BAR = 16;

/**
 * Milliseconds between metronome beats, clamped to 20–300 BPM. A beat is one denominator note
 * (6/8 → eighth notes, 2/2 → half notes), the same spacing the studio's playback metronome uses.
 */
export function beatIntervalMs(bpm: number, signature?: string): number {
  const safe = Number.isFinite(bpm)
    ? Math.min(MAX_METRONOME_BPM, Math.max(MIN_METRONOME_BPM, bpm))
    : 120;
  return signatureTiming(parseSignature(signature ?? "4/4"), safe).beatMs;
}

/** Beat count per bar from a "4/4" / "3/4" / "6/8" string; defaults to 4. */
export function beatsPerBarFromSignature(signature?: string): number {
  const { numerator } = parseSignature(signature ?? "4/4");
  return numerator <= MAX_BEATS_PER_BAR ? numerator : 4;
}

/** Downbeat (index 0 in each bar) receives an accent click and visual highlight. */
export function isAccentBeat(beatIndex: number, beatsPerBar: number): boolean {
  const safeBar = beatsPerBar >= 1 ? Math.floor(beatsPerBar) : 4;
  return ((beatIndex % safeBar) + safeBar) % safeBar === 0;
}

const MIN_METRONOME_BPM = 20;
const MAX_METRONOME_BPM = 300;

/** Milliseconds between metronome beats for the given tempo, clamped to 20–300 BPM. */
export function beatIntervalMs(bpm: number): number {
  const safe = Number.isFinite(bpm)
    ? Math.min(MAX_METRONOME_BPM, Math.max(MIN_METRONOME_BPM, bpm))
    : 120;
  return 60_000 / safe;
}

/** Beat count per bar from a "4/4" / "3/4" / "6/8" string; defaults to 4. */
export function beatsPerBarFromSignature(signature?: string): number {
  if (!signature) return 4;
  const [rawNumerator] = signature.split("/");
  const parsed = Number.parseInt(rawNumerator ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 16 ? parsed : 4;
}

/** Downbeat (index 0 in each bar) receives an accent click and visual highlight. */
export function isAccentBeat(beatIndex: number, beatsPerBar: number): boolean {
  const safeBar = beatsPerBar >= 1 ? Math.floor(beatsPerBar) : 4;
  return ((beatIndex % safeBar) + safeBar) % safeBar === 0;
}

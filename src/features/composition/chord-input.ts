import type { MidiNoteDto } from "../../lib/api/composition.ts";

export const chordQualities = [
  { id: "major", suffix: "", label: "메이저", intervals: [0, 4, 7] },
  { id: "minor", suffix: "m", label: "마이너 (m)", intervals: [0, 3, 7] },
  { id: "7", suffix: "7", label: "세븐 (7)", intervals: [0, 4, 7, 10] },
  { id: "maj7", suffix: "maj7", label: "메이저 세븐 (maj7)", intervals: [0, 4, 7, 11] },
  { id: "m7", suffix: "m7", label: "마이너 세븐 (m7)", intervals: [0, 3, 7, 10] },
  { id: "sus2", suffix: "sus2", label: "서스펜디드 2 (sus2)", intervals: [0, 2, 7] },
  { id: "sus4", suffix: "sus4", label: "서스펜디드 4 (sus4)", intervals: [0, 5, 7] },
  { id: "dim", suffix: "dim", label: "디미니시드 (dim)", intervals: [0, 3, 6] },
  { id: "aug", suffix: "aug", label: "어그먼티드 (aug)", intervals: [0, 4, 8] },
  { id: "dim7", suffix: "dim7", label: "디미니시드 세븐 (dim7)", intervals: [0, 3, 6, 9] },
  { id: "m7b5", suffix: "m7b5", label: "하프 디미니시드 (m7♭5)", intervals: [0, 3, 6, 10] },
  { id: "add9", suffix: "add9", label: "애드 나인 (add9)", intervals: [0, 4, 7, 14] },
] as const;
export type ChordQuality = (typeof chordQualities)[number]["id"];
export const chordRoots = [
  { name: "C", alternate: "" }, { name: "C#", alternate: "Db" },
  { name: "D", alternate: "" }, { name: "D#", alternate: "Eb" },
  { name: "E", alternate: "" }, { name: "F", alternate: "" },
  { name: "F#", alternate: "Gb" }, { name: "G", alternate: "" },
  { name: "G#", alternate: "Ab" }, { name: "A", alternate: "" },
  { name: "A#", alternate: "Bb" }, { name: "B", alternate: "" },
] as const;

export function chordPitches(rootPitch: number, quality: ChordQuality): number[] {
  if (!Number.isInteger(rootPitch)) return [];
  const definition = chordQualities.find((item) => item.id === quality);
  if (!definition) return [];
  const pitches = definition.intervals.map((interval) => rootPitch + interval);
  return pitches.every((pitch) => pitch >= 0 && pitch <= 127) ? pitches : [];
}

export function chordStartTick(positionMs: number, timeline: {
  bpm: number; ppq: number; stepTick: number; clipStartTick: number;
}): number {
  const projectTick = positionMs * timeline.bpm * timeline.ppq / 60_000;
  const gridPosition = (projectTick - timeline.clipStartTick) / timeline.stepTick;
  const nearestGrid = Math.round(gridPosition);
  // Correct conversion noise only; a genuinely off-grid playhead must still round down.
  const grid = Math.abs(gridPosition - nearestGrid) <= 1e-9 ? nearestGrid : Math.floor(gridPosition);
  return Math.max(0, grid * timeline.stepTick);
}

export const chordLengths = [
  { value: "eighth", label: "1/8" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "bar", label: "한 마디" },
] as const;
export type ChordLength = (typeof chordLengths)[number]["value"];

/** The chord picker's note length in ticks ("한 마디" follows the time signature). */
export function chordDurationTick(length: ChordLength, ppq: number,
  signature: { numerator: number; denominator: number }): number {
  return Math.max(1, Math.round(length === "bar" ? ppq * 4 * signature.numerator / signature.denominator
    : ppq * (length === "half" ? 2 : length === "quarter" ? 1 : 0.5)));
}

/** The clip-local playhead snapped down to the grid (conversion noise rounds to the nearest step). */
export function chordGridTick(positionTick: number, stepTick: number): number {
  const grid = positionTick / stepTick;
  const snapped = Math.abs(grid - Math.round(grid)) <= 1e-9 ? Math.round(grid) : Math.floor(grid);
  return Math.max(0, snapped * stepTick);
}

/** A chord button is enabled: every pitch fits the editor's range and the instrument is not the drum kit. */
export function chordFits(rootPitch: number, quality: ChordQuality,
  bounds: { minPitch: number; maxPitch: number }): boolean {
  const pitches = chordPitches(rootPitch, quality);
  return pitches.length > 0 && pitches.every((pitch) => pitch >= bounds.minPitch && pitch <= bounds.maxPitch) &&
    !(bounds.minPitch === 35 && bounds.maxPitch === 81);
}

export function insertChord(notes: MidiNoteDto[], placement: {
  rootPitch: number; quality: ChordQuality; startTick: number; durationTick: number; maxTick: number;
}): { notes: MidiNoteDto[]; reason: "outside-pitch-range" | "outside-timeline" | "overlap" | null } {
  const pitches = chordPitches(placement.rootPitch, placement.quality);
  if (!pitches.length) return { notes, reason: "outside-pitch-range" };
  const { startTick, maxTick } = placement;
  const durationTick = Math.min(placement.durationTick, maxTick - startTick);
  if (![startTick, placement.durationTick, maxTick].every(Number.isSafeInteger) ||
      startTick < 0 || durationTick <= 0) return { notes, reason: "outside-timeline" };
  if (notes.some((note) => pitches.includes(note.pitch) &&
      startTick < note.startTick + note.durationTick && startTick + durationTick > note.startTick))
    return { notes, reason: "overlap" };
  return { reason: null, notes: [...notes, ...pitches.map((pitch) => ({
    pitch, startTick, durationTick, velocity: 100, effectType: null, effectParams: {},
  }))] };
}

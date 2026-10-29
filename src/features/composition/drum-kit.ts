import type { MidiNoteDto } from "../../lib/api/composition";
import { canPlaceNotes, clamp, moveNotes, type NoteBounds } from "./note-editing.ts";

export const basicDrumPads = [
  { pitch: 49, label: "크래시 심벌 1", icon: "crash-left" },
  { pitch: 57, label: "크래시 심벌 2", icon: "crash-right" },
  { pitch: 53, label: "라이드 안쪽 (벨)", icon: "ride-bell" },
  { pitch: 51, label: "라이드 바깥쪽 (보우)", icon: "ride-bow" },
  { pitch: 50, label: "하이 탐", icon: "tom-high" },
  { pitch: 47, label: "미드 탐", icon: "tom-mid" },
  { pitch: 41, label: "플로어 탐", icon: "tom-floor" },
  { pitch: 46, label: "오픈 하이햇", icon: "hihat-open" },
  { pitch: 42, label: "클로즈 하이햇", icon: "hihat-closed" },
  { pitch: 38, label: "스네어", icon: "snare" },
  { pitch: 36, label: "킥", icon: "kick" },
] as const;
export type DrumIconKind = typeof basicDrumPads[number]["icon"] | "percussion";
export const basicDrumPitches: number[] = basicDrumPads.map(pad => pad.pitch);
export function drumPitches(expanded: boolean): number[] {
  return expanded ? Array.from({ length: 47 }, (_, i) => 81 - i) : basicDrumPitches;
}
export function drumPadFor(pitch: number) { return basicDrumPads.find(pad => pad.pitch === pitch); }

/** Percussion moves between visible kit pieces, rather than to a hidden chromatic pitch. */
export function moveDrumNotes(notes: MidiNoteDto[], selected: Set<number>, ticks: number,
  rowDelta: number, rows: number[], bounds: NoteBounds) {
  if (!rowDelta) return moveNotes(notes, selected, ticks, 0, bounds);
  const picked = notes.filter((_, i) => selected.has(i));
  const indices = picked.map(note => rows.indexOf(note.pitch));
  if (!indices.length || indices.some(index => index < 0)) return notes;
  const delta = clamp(Math.round(rowDelta), -Math.min(...indices), rows.length - 1 - Math.max(...indices));
  const dx = clamp(Math.round(ticks), -Math.min(...picked.map(note => note.startTick)),
    bounds.maxTick - Math.max(...picked.map(note => note.startTick + note.durationTick)));
  const changed = picked.map(note => ({ ...note, pitch: rows[rows.indexOf(note.pitch) + delta], startTick: note.startTick + dx }));
  if (!canPlaceNotes(notes.filter((_, i) => !selected.has(i)), changed, bounds)) return notes;
  return notes.map((note, i) => selected.has(i)
    ? { ...note, pitch: rows[rows.indexOf(note.pitch) + delta], startTick: note.startTick + dx } : note);
}

import type { MidiNoteDto } from "../../lib/api/composition";

export type NoteBounds = { maxTick: number; minPitch: number; maxPitch: number };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const sameNotes = (a: MidiNoteDto[], b: MidiNoteDto[]) => JSON.stringify(a) === JSON.stringify(b);
export const pitchName = (pitch: number) => `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const overlaps = (a: MidiNoteDto, b: MidiNoteDto) => a.pitch === b.pitch
  && a.startTick < b.startTick + b.durationTick && a.startTick + a.durationTick > b.startTick;

/** Validate the whole edit before applying it, so a group never partially moves or pastes. */
export function canPlaceNotes(existing: MidiNoteDto[], added: MidiNoteDto[], bounds: NoteBounds) {
  return existing.length + added.length <= 10_000 && added.every((note, index) =>
    Number.isInteger(note.pitch) && note.pitch >= bounds.minPitch && note.pitch <= bounds.maxPitch
    && Number.isSafeInteger(note.startTick) && note.startTick >= 0
    && Number.isSafeInteger(note.durationTick) && note.durationTick > 0
    && note.startTick + note.durationTick <= bounds.maxTick
    && !existing.some(other => overlaps(note, other))
    && !added.slice(0, index).some(other => overlaps(note, other)));
}

export function moveNotes(notes: MidiNoteDto[], selected: Set<number>, ticks: number, pitches: number, bounds: NoteBounds) {
  const picked = notes.filter((_, index) => selected.has(index));
  if (!picked.length) return notes;
  const dx = clamp(Math.round(ticks), -Math.min(...picked.map(n => n.startTick)),
    bounds.maxTick - Math.max(...picked.map(n => n.startTick + n.durationTick)));
  const dy = clamp(Math.round(pitches), bounds.minPitch - Math.min(...picked.map(n => n.pitch)),
    bounds.maxPitch - Math.max(...picked.map(n => n.pitch)));
  const moved = picked.map(n => ({ ...n, startTick: n.startTick + dx, pitch: n.pitch + dy }));
  if (!canPlaceNotes(notes.filter((_, index) => !selected.has(index)), moved, bounds)) return notes;
  return notes.map((n, index) => selected.has(index) ? { ...n, startTick: n.startTick + dx, pitch: n.pitch + dy } : n);
}

export function resizeNotes(notes: MidiNoteDto[], selected: Set<number>, ticks: number, minTick: number, bounds: NoteBounds) {
  const picked = notes.filter((_, index) => selected.has(index));
  if (!picked.length) return notes;
  // Preserve the relative lengths, including imported notes shorter than the current grid.
  const delta = clamp(Math.round(ticks), Math.min(minTick, ...picked.map(n => n.durationTick)) - Math.min(...picked.map(n => n.durationTick)),
    Math.min(...picked.map(n => bounds.maxTick - n.startTick - n.durationTick)));
  const resized = picked.map(n => ({ ...n, durationTick: n.durationTick + delta }));
  if (!canPlaceNotes(notes.filter((_, index) => !selected.has(index)), resized, bounds)) return notes;
  return notes.map((n, index) => selected.has(index) ? { ...n, durationTick: n.durationTick + delta } : n);
}

export function copyNotes(notes: MidiNoteDto[], selected: Set<number>) {
  const picked = notes.filter((_, index) => selected.has(index));
  const origin = Math.min(...picked.map(n => n.startTick));
  return picked.map(n => ({ ...structuredClone(n), startTick: n.startTick - origin }));
}

export function pasteNotes(notes: MidiNoteDto[], clipboard: MidiNoteDto[], at: number, bounds: NoteBounds) {
  if (!clipboard.length) return notes;
  const span = Math.max(...clipboard.map(n => n.startTick + n.durationTick));
  if (span > bounds.maxTick) return notes;
  const origin = clamp(Math.round(at), 0, bounds.maxTick - span);
  const added = clipboard.map(n => ({ ...structuredClone(n), startTick: origin + n.startTick }));
  return canPlaceNotes(notes, added, bounds) ? [...notes, ...added] : notes;
}

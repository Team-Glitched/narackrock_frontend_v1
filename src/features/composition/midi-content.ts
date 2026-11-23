import type { ClipDto } from "../../lib/api/composition.ts";

type Timing = { bpm: number; ppq: number; maxTick: number };

/** Note-free MIDI is kept for editing but is neither drawn on nor occupies the timeline. */
export function isEmptyMidi(clip: Partial<Pick<ClipDto, "clipType" | "midiNotes">>) {
  return clip.clipType === "MIDI" && clip.midiNotes?.length === 0;
}

/**
 * Editing placeholder for note-free MIDI, matching the backend's empty-draft commit: the start is
 * kept while a positive span fits before the limit, so delete-all/undo stays in place.
 */
export function emptyMidiRange(startTick: number, ppq: number, maxTick: number) {
  const placeholder = Math.max(1, Math.ceil(ppq / 4));
  return startTick < maxTick
    ? { startTick, durationTick: Math.min(placeholder, maxTick - startTick) }
    : { startTick: 0, durationTick: placeholder };
}

/** MIDI length follows its notes; empty content keeps only a positive editing placeholder. */
export function midiContent<T extends { startTick: number; durationTick: number }>(
  startTick: number,
  midiNotes: T[],
  { bpm, ppq, maxTick }: Timing,
) {
  if (!midiNotes.length) return { ...emptyMidiRange(startTick, ppq, maxTick), midiNotes };
  const end = midiNotes.reduce((last, note) => Math.max(last, note.startTick + note.durationTick), 0);
  // The backend floors tick→ms; a span under one millisecond would render as an empty clip.
  return { startTick, durationTick: Math.max(end, Math.ceil((bpm * ppq) / 60000)), midiNotes };
}

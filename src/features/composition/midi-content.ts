import type { ClipDto } from "../../lib/api/composition.ts";
import type { TimeSignature } from "./time-signature.ts";

type MidiShape = { clipType?: ClipDto["clipType"]; midiNotes?: readonly unknown[] };

/** Note-free MIDI is kept for editing but is neither drawn on nor occupies the timeline. */
export function isEmptyMidi(clip: MidiShape) {
  return clip.clipType === "MIDI" && clip.midiNotes?.length === 0;
}

/**
 * Track-settings entries reopening a track's note-free MIDI; with several, each names its start
 * position ("n마디 m박") so they stay distinguishable.
 */
export function emptyMidiChoices(
  clips: readonly (MidiShape & Pick<ClipDto, "clipId" | "startTick">)[],
  ppq: number,
  signature: TimeSignature,
) {
  const empty = clips.filter(isEmptyMidi);
  const beatTick = (ppq * 4) / signature.denominator;
  return empty.map(({ clipId, startTick }) => {
    const beats = Math.floor(startTick / beatTick);
    const position = `${Math.floor(beats / signature.numerator) + 1}마디 ${(beats % signature.numerator) + 1}박`;
    return { clipId, label: empty.length === 1 ? "빈 MIDI 이어서 편집" : `${position} 빈 MIDI 편집` };
  });
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
  { ppq, maxTick }: { ppq: number; maxTick: number },
) {
  if (!midiNotes.length) return { ...emptyMidiRange(startTick, ppq, maxTick), midiNotes };
  const durationTick = midiNotes.reduce(
    (end, note) => Math.max(end, note.startTick + note.durationTick),
    0,
  );
  return { startTick, durationTick, midiNotes };
}

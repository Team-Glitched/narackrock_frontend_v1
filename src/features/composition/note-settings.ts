import type { MidiNoteDto } from "../../lib/api/composition.ts";

/**
 * Rules of the note settings dialog, shared by the web dialog and the app's sheet. Length is edited in snap
 * steps and never drops below one step (or the note's original length when that is already shorter); volume
 * is a 1–100 % view of the 0–127 MIDI velocity.
 */
export const noteLengthLimits = (initial: MidiNoteDto, note: MidiNoteDto, stepTick: number, maxTick: number) => ({
  min: Math.min(1, initial.durationTick / stepTick),
  max: (maxTick - note.startTick) / stepTick,
});

export function withNoteLength(initial: MidiNoteDto, note: MidiNoteDto, steps: number,
  stepTick: number, maxTick: number): MidiNoteDto {
  const durationTick = Math.max(
    Math.min(stepTick, initial.durationTick),
    Math.round(Math.min(maxTick - note.startTick, steps * stepTick)),
  );
  return { ...note, durationTick };
}

export const notePercent = (note: MidiNoteDto) => Math.round((note.velocity / 127) * 100);

export const withNotePercent = (note: MidiNoteDto, percent: number): MidiNoteDto =>
  ({ ...note, velocity: Math.max(1, Math.round((percent / 100) * 127)) });

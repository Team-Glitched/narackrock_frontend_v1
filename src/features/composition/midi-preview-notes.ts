import type { MidiNoteDto } from "../../lib/api/composition.ts";

export const midiPreviewHeight = 32;

/** Positions are relative to the clip, including any silence before or after its notes. */
export function midiPreviewNotes(
  notes: readonly Pick<MidiNoteDto, "pitch" | "startTick" | "durationTick">[],
  clipDurationTick: number,
) {
  const visible = notes.filter(
    (note) =>
      note.durationTick > 0 &&
      note.startTick < clipDurationTick &&
      note.startTick + note.durationTick > 0,
  );
  if (clipDurationTick <= 0 || visible.length === 0) return [];

  let low = 127;
  let high = 0;
  for (const { pitch } of visible) {
    low = Math.min(low, pitch);
    high = Math.max(high, pitch);
  }
  const centerPitch = (low + high) / 2;
  const pitchStep = 22 / Math.max(12, high - low);
  return visible.map((note) => {
    const startTick = Math.max(0, note.startTick);
    const endTick = Math.min(clipDurationTick, note.startTick + note.durationTick);
    return {
      startTick,
      durationTick: endTick - startTick,
      y: midiPreviewHeight / 2 - (note.pitch - centerPitch) * pitchStep,
    };
  });
}

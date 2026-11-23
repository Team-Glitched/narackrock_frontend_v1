/** MIDI length follows its notes; empty content keeps only a positive editing placeholder. */
export function midiContent<T extends { startTick: number; durationTick: number }>(
  startTick: number,
  midiNotes: T[],
  ppq: number,
  maxTick = Infinity,
) {
  const durationTick = midiNotes.length
    ? midiNotes.reduce((end, note) => Math.max(end, note.startTick + note.durationTick), 0)
    : Math.max(1, Math.ceil(ppq / 4));
  return {
    // Preserve the position across delete/undo; only obsolete empty ranges need relocation.
    startTick: !midiNotes.length && startTick + durationTick > maxTick ? 0 : startTick,
    durationTick,
    midiNotes,
  };
}

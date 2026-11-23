import type { MidiNoteDto } from "../../lib/api/composition.ts";
import { findInstrument, invalidPitchesFor, samplePitches } from "./instrument-catalog.ts";
import { pianoRenderLength } from "./piano-render-plan.ts";

export const sourceRenderSampleRate = 44_100;
export const sourceReleaseSeconds = 0.08;

export function validateSourceInstrument(notes: MidiNoteDto[], id: string) {
  const instrument = findInstrument(id);
  if (!instrument) throw new Error("피아노롤에서 사용할 수 있는 악기를 선택해주세요.");
  if (
    invalidPitchesFor(
      instrument,
      notes.map((note) => note.pitch),
    ).length
  )
    throw new Error(
      "기존 노트가 선택한 악기의 음역을 벗어납니다. 노트를 수정하거나 다른 악기를 선택해주세요.",
    );
  return instrument;
}

/** Uses the composition sampler's bank, nearest-pitch rule and release on both platforms. */
export function sourceRenderPlan(notes: MidiNoteDto[], bpm: number, id: string) {
  const instrument = validateSourceInstrument(notes, id);
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("올바른 BPM을 입력해주세요.");
  const { tickSeconds, durationSeconds } = pianoRenderLength(notes, bpm);
  const pitches = samplePitches(instrument);
  const voices = notes.map((note) => {
    const sample = pitches.reduce((best, pitch) =>
      Math.abs(pitch - note.pitch) < Math.abs(best - note.pitch) ||
      (Math.abs(pitch - note.pitch) === Math.abs(best - note.pitch) && pitch > best)
        ? pitch
        : best,
    );
    const start = note.startTick * tickSeconds;
    return {
      sample,
      url: `/audio/instruments/${instrument.id}/${sample}.mp3`,
      playbackRate: 2 ** ((note.pitch - sample) / 12),
      start,
      end: start + note.durationTick * tickSeconds,
      velocity: note.velocity / 127,
    };
  });
  return {
    instrument,
    voices,
    durationSeconds: Math.min(60, durationSeconds + sourceReleaseSeconds),
  };
}

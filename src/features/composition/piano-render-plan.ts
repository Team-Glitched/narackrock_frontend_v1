import type { MidiNoteDto } from "../../lib/api/composition.ts";

/**
 * Pure plan of `renderPianoAudio`, shared by the web renderer (source-piano-render.ts) and the
 * app's native renderer (native/audio/render.ts) so both turn notes into the same voices.
 */

export const pianoRenderSampleRate = 44_100;

/** MIDI pitches of the samples in public/audio/piano. */
export const pianoSamplePitches = [21, 24, 36, 48];

/** Sample levels: recorded piano, or the quieter triangle fallback when samples cannot load. */
export const pianoSampleLevel = 0.8;
export const pianoFallbackLevel = 0.18;

/** File name (without extension) of a piano sample: A0, C1, C2, C3. */
export function pianoSampleName(pitch: number): string {
  return pitch === 21 ? "A0" : `C${pitch / 12 - 1}`;
}

/** The closest piano sample; on a tie the lower one. */
export function nearestPianoSample(pitch: number): number {
  return pianoSamplePitches.reduce((best, sample) =>
    Math.abs(pitch - sample) < Math.abs(pitch - best) ? sample : best,
  );
}

/** Seconds per tick and the rendered length; throws the web's messages for unusable notes. */
export function pianoRenderLength(
  notes: MidiNoteDto[],
  bpm: number,
): { tickSeconds: number; durationSeconds: number } {
  if (!notes.length) throw new Error("노트를 추가해주세요.");
  const tickSeconds = 60 / (bpm * 480);
  const durationSeconds = Math.max(
    ...notes.map((note) => (note.startTick + note.durationTick) * tickSeconds),
  );
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60)
    throw new Error("오디오 길이는 1분 이하여야 합니다.");
  return { tickSeconds, durationSeconds };
}

export type PianoVoice = {
  start: number;
  end: number;
  /** Velocity as 0–1; multiply by the sample or fallback level. */
  velocity: number;
  sample: number;
  /** Playback rate that shifts `sample` to the note's pitch. */
  playbackRate: number;
  /** Fallback oscillator frequency in Hz. */
  frequency: number;
};

export function pianoVoice(note: MidiNoteDto, tickSeconds: number): PianoVoice {
  const start = note.startTick * tickSeconds;
  const sample = nearestPianoSample(note.pitch);
  return {
    start,
    end: start + note.durationTick * tickSeconds,
    velocity: note.velocity / 127,
    sample,
    playbackRate: 2 ** ((note.pitch - sample) / 12),
    frequency: 440 * 2 ** ((note.pitch - 69) / 12),
  };
}

type EnvelopeParam = {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
};

export function scheduleMidiEnvelope(
  gain: EnvelopeParam,
  start: number,
  end: number,
  level: number,
) {
  const duration = Math.max(0, end - start);
  const attack = Math.min(0.01, duration / 4);
  const release = Math.min(0.08, duration / 4);
  gain.setValueAtTime(0, start);
  gain.linearRampToValueAtTime(level, start + attack);
  gain.setValueAtTime(level, end - release);
  gain.linearRampToValueAtTime(0, end);
}

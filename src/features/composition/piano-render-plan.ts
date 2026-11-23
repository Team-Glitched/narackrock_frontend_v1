import type { MidiNoteDto } from "../../lib/api/composition.ts";
import {
  findInstrument,
  samplePitches,
  type InstrumentDefinition,
} from "./instrument-catalog.ts";

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

const fallbackPianoInstrument: InstrumentDefinition = {
  id: "piano",
  label: "피아노",
  kind: "pitched",
  program: 0,
  pitches: [21, 36, 48, 60, 72, 84, 96],
};

/** Resolves a sampled MIDI instrument for sample piano roll rendering, falling back to piano. */
export function resolveSampleInstrument(instrumentId?: string | null): InstrumentDefinition {
  return findInstrument(instrumentId ?? "piano") ?? findInstrument("piano") ?? fallbackPianoInstrument;
}

/** Nearest sample and playback rate matching Tone.Sampler semantics (ties prefer higher pitch). */
export function nearestInstrumentSample(
  instrument: InstrumentDefinition,
  pitch: number,
): { sample: number; playbackRate: number } {
  if (instrument.kind === "drum") {
    const min = instrument.minPitch ?? 35;
    const max = instrument.maxPitch ?? 81;
    const sample = Math.min(max, Math.max(min, Math.round(pitch)));
    return { sample, playbackRate: 1 };
  }
  const available = samplePitches(instrument);
  if (!available.length) return { sample: nearestPianoSample(pitch), playbackRate: 1 };
  const sample = available.reduce((best, candidate) => {
    const dBest = Math.abs(pitch - best);
    const dCandidate = Math.abs(pitch - candidate);
    return dCandidate < dBest || (dCandidate === dBest && candidate > best) ? candidate : best;
  });
  return { sample, playbackRate: 2 ** ((pitch - sample) / 12) };
}

/** Audio URL under `/audio/instruments/<id>/<pitch>.mp3`. */
export function instrumentSampleUrl(
  instrument: InstrumentDefinition,
  samplePitch: number,
): string {
  return `/audio/instruments/${instrument.id}/${samplePitch}.mp3`;
}

/** Unique sample pitches required to render `notes` for `instrument`. */
export function requiredSamplePitches(
  instrument: InstrumentDefinition,
  notes: readonly Pick<MidiNoteDto, "pitch">[],
): number[] {
  const unique = new Set<number>();
  for (const note of notes) {
    unique.add(nearestInstrumentSample(instrument, note.pitch).sample);
  }
  return [...unique];
}

export function instrumentVoice(
  instrument: InstrumentDefinition,
  note: MidiNoteDto,
  tickSeconds: number,
): PianoVoice {
  const start = note.startTick * tickSeconds;
  const { sample, playbackRate } = nearestInstrumentSample(instrument, note.pitch);
  return {
    start,
    end: start + note.durationTick * tickSeconds,
    velocity: note.velocity / 127,
    sample,
    playbackRate,
    frequency: 440 * 2 ** ((note.pitch - 69) / 12),
  };
}

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

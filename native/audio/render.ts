// `audio-render-notes`: the web's `renderPianoAudio` (source-piano-render.ts) rendered natively.
import { OfflineAudioContext, type AudioBuffer } from "react-native-audio-api";

import type { MidiNoteDto } from "../../src/lib/api/composition.ts";
import type { NativeAudioFile } from "../../src/lib/native-bridge-protocol";
import {
  instrumentSampleUrl,
  instrumentVoice,
  pianoFallbackLevel,
  pianoRenderLength,
  pianoRenderSampleRate,
  pianoSampleLevel,
  requiredSamplePitches,
  resolveSampleInstrument,
  scheduleMidiEnvelope,
} from "../../src/features/composition/piano-render-plan.ts";
import { wavBytes } from "../../src/features/composition/prepare-audio-file.ts";
import { bytesToBase64 } from "./logic.ts";

/** Renders authored notes with the selected sampled instrument (triangle fallback) to a stereo WAV. */
export async function renderNotes(
  origin: string,
  notes: MidiNoteDto[],
  bpm: number,
  instrumentId = "piano",
): Promise<NativeAudioFile> {
  const { tickSeconds, durationSeconds } = pianoRenderLength(notes, bpm);
  const instrument = resolveSampleInstrument(instrumentId);
  const sampleKeys = requiredSamplePitches(instrument, notes);
  const context = new OfflineAudioContext(
    2,
    Math.ceil(durationSeconds * pianoRenderSampleRate),
    pianoRenderSampleRate,
  );
  let samples = new Map<number, AudioBuffer>();
  try {
    samples = new Map(
      await Promise.all(
        sampleKeys.map(async (pitch) => {
          const response = await fetch(`${origin}${instrumentSampleUrl(instrument, pitch)}`);
          if (!response.ok) throw new Error(`${instrument.label} 샘플을 불러오지 못했습니다.`);
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }),
      ),
    );
  } catch {
    /* Use the same triangle fallback as the web. */
  }
  for (const note of notes) {
    const voice = instrumentVoice(instrument, note, tickSeconds);
    const buffer = samples.get(voice.sample);
    const gain = context.createGain();
    gain.connect(context.destination);
    scheduleMidiEnvelope(
      gain.gain,
      voice.start,
      voice.end,
      voice.velocity * (buffer ? pianoSampleLevel : pianoFallbackLevel),
    );
    if (buffer) {
      // One-shot like the preview's sampler voices (graph.ts): a note longer than its sample ends in silence.
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = voice.playbackRate;
      source.connect(gain);
      source.start(voice.start);
      source.stop(voice.end);
    } else {
      const source = context.createOscillator();
      source.type = "triangle";
      source.frequency.value = voice.frequency;
      source.connect(gain);
      source.start(voice.start);
      source.stop(voice.end);
    }
  }
  const rendered = await context.startRendering();
  return {
    name: `${instrument.id}.wav`,
    type: "audio/wav",
    base64: bytesToBase64(new Uint8Array(wavBytes(rendered))),
  };
}

// `audio-render-notes`: the web's `renderPianoAudio` (source-piano-render.ts) rendered natively.
import { OfflineAudioContext, type AudioBuffer } from "react-native-audio-api";

import type { MidiNoteDto } from "../../src/lib/api/composition.ts";
import type { NativeAudioFile } from "../../src/lib/native-bridge-protocol";
import {
  pianoFallbackLevel,
  pianoRenderLength,
  pianoRenderSampleRate,
  pianoSampleLevel,
  pianoSampleName,
  pianoSamplePitches,
  pianoVoice,
  scheduleMidiEnvelope,
} from "../../src/features/composition/piano-render-plan.ts";
import { wavBytes } from "../../src/features/composition/prepare-audio-file.ts";
import { bytesToBase64 } from "./logic.ts";

/** Renders authored notes with the piano samples (triangle fallback) to a stereo WAV. */
export async function renderNotes(
  origin: string,
  notes: MidiNoteDto[],
  bpm: number,
): Promise<NativeAudioFile> {
  const { tickSeconds, durationSeconds } = pianoRenderLength(notes, bpm);
  const context = new OfflineAudioContext(
    2,
    Math.ceil(durationSeconds * pianoRenderSampleRate),
    pianoRenderSampleRate,
  );
  let samples = new Map<number, AudioBuffer>();
  try {
    samples = new Map(
      await Promise.all(
        pianoSamplePitches.map(async (pitch) => {
          const response = await fetch(`${origin}/audio/piano/${pianoSampleName(pitch)}.mp3`);
          if (!response.ok) throw new Error("피아노 샘플을 불러오지 못했습니다.");
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }),
      ),
    );
  } catch {
    /* Use the same triangle fallback as the web. */
  }
  for (const note of notes) {
    const voice = pianoVoice(note, tickSeconds);
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
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = voice.playbackRate;
      source.loop = voice.end - voice.start > buffer.duration / voice.playbackRate;
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
    name: "piano.wav",
    type: "audio/wav",
    base64: bytesToBase64(new Uint8Array(wavBytes(rendered))),
  };
}

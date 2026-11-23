import type { MidiNoteDto } from "@/lib/api/composition";
import { nativeApp, nativeAudioToFile, requestNative } from "@/lib/native-app";
import { audioBufferToWav } from "./prepare-audio-file";
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
} from "./piano-render-plan";

/** Render authored notes with the chosen sampled instrument to the WAV attachment; no MIDI upload. */
export async function renderPianoAudio(
  notes: MidiNoteDto[],
  bpm: number,
  instrumentId = "piano",
): Promise<File> {
  const { tickSeconds, durationSeconds } = pianoRenderLength(notes, bpm);
  // The app renders with its native engine (same samples and plan).
  if (nativeApp()) {
    const { audio } = await requestNative("audio-render-notes", { notes, bpm, instrumentId });
    return nativeAudioToFile(audio);
  }
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
          const response = await fetch(instrumentSampleUrl(instrument, pitch));
          if (!response.ok) throw new Error(`${instrument.label} 샘플을 불러오지 못했습니다.`);
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }),
      ),
    );
  } catch {
    /* Use the same triangle fallback as composition playback. */
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
      // One-shot like the preview's Tone.Sampler: a note longer than its sample ends in silence.
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
  return audioBufferToWav(await context.startRendering(), `${instrument.id}.wav`);
}

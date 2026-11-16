import type { MidiNoteDto } from "@/lib/api/composition";
import { nativeApp, nativeAudioToFile, requestNative } from "@/lib/native-app";
import { audioBufferToWav } from "./prepare-audio-file";
import {
  pianoFallbackLevel,
  pianoRenderLength,
  pianoRenderSampleRate,
  pianoSampleLevel,
  pianoSampleName,
  pianoSamplePitches,
  pianoVoice,
  scheduleMidiEnvelope,
} from "./piano-render-plan";

/** Render authored notes to the audio attachment; no MIDI upload or HTI conversion. */
export async function renderPianoAudio(notes: MidiNoteDto[], bpm: number): Promise<File> {
  const { tickSeconds, durationSeconds } = pianoRenderLength(notes, bpm);
  // The app renders with its native engine (same samples and plan).
  if (nativeApp()) {
    const { audio } = await requestNative("audio-render-notes", { notes, bpm });
    return nativeAudioToFile(audio);
  }
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
          const response = await fetch(`/audio/piano/${pianoSampleName(pitch)}.mp3`);
          if (!response.ok) throw new Error("피아노 샘플을 불러오지 못했습니다.");
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }),
      ),
    );
  } catch {
    /* Use the same triangle fallback as composition playback. */
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
  return audioBufferToWav(await context.startRendering(), "piano.wav");
}

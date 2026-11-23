import type { MidiNoteDto } from "@/lib/api/composition";
import { nativeApp, nativeAudioToFile, requestNative } from "@/lib/native-app";
import { audioBufferToWav } from "./prepare-audio-file";
import {
  sourceRenderPlan,
  sourceRenderSampleRate,
  sourceReleaseSeconds,
} from "./source-render-plan";

/** Renders the selected composition instrument to the sample's actual audio attachment. */
export async function renderSourceAudio(
  notes: MidiNoteDto[],
  bpm: number,
  instrument: string,
): Promise<File> {
  const plan = sourceRenderPlan(notes, bpm, instrument);
  if (nativeApp()) {
    const { audio } = await requestNative("audio-render-notes", {
      notes,
      bpm,
      instrument: plan.instrument.id,
    });
    return nativeAudioToFile(audio);
  }
  const context = new OfflineAudioContext(
    2,
    Math.ceil(plan.durationSeconds * sourceRenderSampleRate),
    sourceRenderSampleRate,
  );
  const samples = new Map(
    await Promise.all(
      [...new Set(plan.voices.map((voice) => voice.url))].map(async (url) => {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(
            `${plan.instrument.label} 샘플을 불러오지 못했습니다. 다시 시도해주세요.`,
          );
        return [url, await context.decodeAudioData(await response.arrayBuffer())] as const;
      }),
    ),
  );
  for (const voice of plan.voices) {
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(voice.velocity, voice.start);
    gain.gain.setValueAtTime(voice.velocity, voice.end);
    gain.gain.linearRampToValueAtTime(0, voice.end + sourceReleaseSeconds);
    const source = context.createBufferSource();
    source.buffer = samples.get(voice.url)!;
    source.playbackRate.value = voice.playbackRate;
    source.connect(gain);
    source.start(voice.start);
    source.stop(voice.end + sourceReleaseSeconds);
  }
  return audioBufferToWav(await context.startRendering(), `${plan.instrument.id}.wav`);
}

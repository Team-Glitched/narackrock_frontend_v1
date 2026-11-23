// Renders the sample registration's selected instrument with the same plan as the web.
import { OfflineAudioContext } from "react-native-audio-api";
import type { MidiNoteDto } from "../../src/lib/api/composition.ts";
import type { NativeAudioFile } from "../../src/lib/native-bridge-protocol";
import {
  sourceRenderPlan,
  sourceRenderSampleRate,
  sourceReleaseSeconds,
} from "../../src/features/composition/source-render-plan.ts";
import { wavBytes } from "../../src/features/composition/prepare-audio-file.ts";
import { bytesToBase64 } from "./logic.ts";

export async function renderNotes(
  origin: string,
  notes: MidiNoteDto[],
  bpm: number,
  instrument: string,
): Promise<NativeAudioFile> {
  const plan = sourceRenderPlan(notes, bpm, instrument);
  const context = new OfflineAudioContext(
    2,
    Math.ceil(plan.durationSeconds * sourceRenderSampleRate),
    sourceRenderSampleRate,
  );
  const samples = new Map(
    await Promise.all(
      [...new Set(plan.voices.map((voice) => voice.url))].map(async (url) => {
        const response = await fetch(`${origin}${url}`);
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
  return {
    name: `${plan.instrument.id}.wav`,
    type: "audio/wav",
    base64: bytesToBase64(new Uint8Array(wavBytes(await context.startRendering()))),
  };
}

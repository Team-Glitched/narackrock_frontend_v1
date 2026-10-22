import type { CompositionDto } from "../../lib/api/composition.ts";
import { instrumentFor } from "./instrument-catalog.ts";

export const drumTailMs = 1_500;

export function compositionEndMs(composition: { project: Pick<CompositionDto["project"], "bpm" | "ppq" | "maxDurationMs"> }, tracks: CompositionDto["tracks"]): number {
  const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
  return Math.min(composition.project.maxDurationMs, Math.max(0,
    ...tracks.flatMap((track) => track.clips.map((clip) => clip.clipType === "MIDI"
      ? Math.max(0, ...(clip.midiNotes ?? []).map((note) => {
          const startMs = (clip.startTick + note.startTick) * tickMs;
          const durationMs = note.durationTick * tickMs;
          return startMs + Math.max(durationMs,
            instrumentFor(track.instrument).kind === "drum" ? drumTailMs : 0);
        }))
      : clip.startTimeMs + (clip.durationMs ?? 0))),
  ));
}

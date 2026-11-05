import type { CompositionDto } from "../../lib/api/composition";

/** Playback and its scrubber use the same audible clip boundary. */
export function compositionDurationMs(composition: CompositionDto): number {
  const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
  const hasSolo = composition.tracks.some((track) => track.isSolo && !track.isMuted);
  return Math.min(
    composition.project.maxDurationMs,
    Math.max(
      0,
      ...composition.tracks
        .filter((track) => !track.isMuted && (!hasSolo || track.isSolo))
        .flatMap((track) =>
          track.clips.map((clip) =>
            clip.clipType === "MIDI"
              ? Math.max(
                  0,
                  ...(clip.midiNotes ?? []).map(
                    (note) => (clip.startTick + note.startTick + note.durationTick) * tickMs,
                  ),
                )
              : clip.startTimeMs + (clip.durationMs ?? 0),
          ),
        ),
    ),
  );
}

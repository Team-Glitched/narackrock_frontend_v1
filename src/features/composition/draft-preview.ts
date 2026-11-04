import type { CompositionDto } from "../../lib/api/composition.ts";
import type { DraftContent, ServerDraft } from "./editor-draft.ts";

export type PreviewDraft = { trackId: number; targetClipId: number | null; content: DraftContent };

/** Personal working copies overlay a separate composition; the shared response remains untouched. */
export function withPersonalDrafts(
  composition: CompositionDto,
  drafts: PreviewDraft[],
): CompositionDto {
  const tickMs = 60000 / (composition.project.bpm * composition.project.ppq);
  return {
    ...composition,
    tracks: composition.tracks.map((track) => {
      const own = drafts.filter((draft) => draft.trackId === track.trackId);
      if (!own.length) return track;
      const clips = track.clips.map((clip) => {
        const draft = own.find((item) => item.targetClipId === clip.clipId);
        return draft
          ? {
              ...clip,
              ...draft.content,
              startTimeMs: draft.content.startTick * tickMs,
              durationMs: draft.content.durationTick * tickMs,
            }
          : clip;
      });
      for (const draft of own.filter((item) => item.targetClipId === null))
        clips.push({
          clipId: -track.trackId,
          ownerId: composition.viewerPermission.userId,
          clipType: "MIDI",
          sourceType: "MIDI_INPUT",
          mediaFileId: null,
          mediaUrl: null,
          clipOffsetMs: 0,
          approvalStatus: "DRAFT",
          ...draft.content,
          startTimeMs: draft.content.startTick * tickMs,
          durationMs: draft.content.durationTick * tickMs,
        });
      return { ...track, clips };
    }),
  };
}

export function activeDrafts(drafts: ServerDraft[]) {
  return drafts.filter((draft) => draft.status === "ACTIVE");
}

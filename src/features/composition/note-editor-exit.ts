import type { DraftContent, DraftState } from "./editor-draft.ts";
import { sameNotes } from "./note-editing.ts";

/** A saved personal draft can still differ from the shared clip; compare content, not save status. */
export function canLeaveUnchangedDraft(baseClip: DraftContent | null, draft: DraftState | null) {
  if (!baseClip || !draft || draft.status === "conflict") return false;
  return (
    draft.content.startTick === baseClip.startTick &&
    draft.content.durationTick === baseClip.durationTick &&
    sameNotes(draft.content.midiNotes, baseClip.midiNotes)
  );
}

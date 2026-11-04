import { ApiError, apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { getEditorDraft, getEditorDrafts, saveEditorDraft } from "@/lib/api/composition-drafts";
import {
  DraftSession,
  listLocalDrafts,
  removeLocalDraft,
  type DraftStorage,
  type ServerDraft,
} from "./editor-draft";

/**
 * Uploads browser-only edits of this project before a deliberate submit/publish. Conflicts stay recoverable and
 * abort the action; the server's ACTIVE drafts are returned for the atomic commit/submit request.
 */
export async function syncProjectEditorDrafts(
  projectId: number,
  userId: number,
  storage: DraftStorage | null,
) {
  const remote = await getEditorDrafts(projectId);
  for (const local of listLocalDrafts(storage, apiOrigin(), userId, projectId)) {
    if (!local.dirty && !local.pending) continue;
    if (getCurrentUserId() !== userId) throw new Error("로그인 계정이 변경되었습니다.");
    let server: ServerDraft | null =
      remote.find(
        (draft) => draft.trackId === local.trackId && draft.targetClipId === local.targetClipId,
      ) ?? null;
    if (!server) {
      try {
        server = await getEditorDraft(projectId, local.draftId);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    if (
      server?.status === "COMMITTED" &&
      JSON.stringify(local.content) === JSON.stringify(server.content)
    ) {
      removeLocalDraft(storage, local, local.draftId, server.content);
      continue;
    }
    const session = new DraftSession({
      context: local,
      content: local.content,
      baseClip: local.baseClip,
      storage,
      local,
      server,
      save: (request, id) => {
        if (getCurrentUserId() !== userId) throw new Error("로그인 계정이 변경되었습니다.");
        return saveEditorDraft(projectId, local.trackId, id, request);
      },
    });
    try {
      await session.flush();
    } finally {
      session.dispose();
    }
  }
  return getEditorDrafts(projectId);
}

/** Removes local recovery copies whose content is now committed on the server. */
export function clearCommittedRecovery(storage: DraftStorage | null, drafts: ServerDraft[]) {
  for (const draft of drafts)
    removeLocalDraft(
      storage,
      {
        origin: apiOrigin(),
        userId: draft.ownerId,
        projectId: draft.projectId,
        trackId: draft.trackId,
        targetClipId: draft.targetClipId,
      },
      draft.draftId,
      draft.content,
    );
}

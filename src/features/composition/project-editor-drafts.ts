import { getCurrentUserId } from "@/lib/api/client";
import { getEditorDraft, getEditorDrafts, saveEditorDraft } from "@/lib/api/composition-drafts";
import { DraftSession, listLocalDrafts, removeLocalDraft, type DraftStorage, type ServerDraft } from "./editor-draft";

/** Upload browser-only edits before a deliberate submit/publish action. Conflicts remain recoverable. */
export async function syncProjectEditorDrafts(projectId: number, userId: number, storage: DraftStorage | null) {
  const remote = await getEditorDrafts(projectId);
  for (const local of listLocalDrafts(storage, userId, projectId)) {
    if (!local.dirty && !local.pending) continue;
    if (getCurrentUserId() !== userId) throw new Error("로그인 계정이 변경되었습니다.");
    let server: ServerDraft | null = remote.find(d => d.trackId === local.trackId && d.targetClipId === local.targetClipId) ?? null;
    if (!server) {
      try { server = await getEditorDraft(projectId, local.draftId); }
      catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
    }
    if (server?.status === "COMMITTED" && JSON.stringify(local.content) === JSON.stringify(server.content)) {
      removeLocalDraft(storage, local, local.draftId, server.content); continue;
    }
    const session = new DraftSession({ context: local, content: local.content, baseClip: local.baseClip,
      storage, local, server, save: (request, id) => {
        if (getCurrentUserId() !== userId) throw new Error("로그인 계정이 변경되었습니다.");
        return saveEditorDraft(projectId, local.trackId, id, request);
      } });
    try { await session.flush(); } finally { session.dispose(); }
  }
  return getEditorDrafts(projectId);
}

export function clearCommittedRecovery(storage: DraftStorage | null, drafts: ServerDraft[]) {
  for (const draft of drafts) removeLocalDraft(storage, { userId: draft.ownerId, projectId: draft.projectId,
    trackId: draft.trackId, targetClipId: draft.targetClipId }, draft.draftId, draft.content);
}

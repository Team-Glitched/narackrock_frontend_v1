"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getCurrentUserId, ApiError } from "@/lib/api/client";
import { commitEditorDraft, discardEditorDraft, getEditorDraft, getEditorDrafts, saveEditorDraft } from "@/lib/api/composition-drafts";
import { DraftSession, draftStorageKey, readLocalDraft, removeLocalDraft,
  type DraftContext, type DraftContent, type DraftStorage, type ServerDraft } from "./editor-draft";

export function browserDraftStorage(): DraftStorage | null {
  try { return window.localStorage; } catch { return null; }
}

const subscribeNothing = () => () => {};
const emptySnapshot = () => null;

export function useEditorDraft(options: {
  context: DraftContext; content: DraftContent; baseClip: DraftContent | null; enabled: boolean;
  onCommittedRecovery: (clipId: number) => void;
}) {
  const { context, content, baseClip, enabled, onCommittedRecovery } = options;
  const [session, setSession] = useState<DraftSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRevision, reload] = useState(0);
  const [restored, setRestored] = useState(false);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeNothing, session?.getSnapshot ?? emptySnapshot, emptySnapshot);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let opened: DraftSession | null = null;
    const storage = browserDraftStorage();
    (async () => {
      let local = readLocalDraft(storage, context);
      let remote: ServerDraft | null = null;
      try {
        const drafts = await getEditorDrafts(context.projectId);
        remote = drafts.find(d => d.trackId === context.trackId && d.targetClipId === context.targetClipId) ?? null;
        if (local && !remote) {
          try { remote = await getEditorDraft(context.projectId, local.draftId); }
          catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
        }
      } catch (error) {
        if (!local) throw error;
        if (!cancelled) setLoadError("서버 초안을 불러오지 못해 이 기기의 복구본을 열었습니다.");
      }
      if (cancelled) return;
      if (remote && remote.status !== "ACTIVE" && local
          && JSON.stringify(local.content) === JSON.stringify(remote.content)) {
        removeLocalDraft(storage, context, local.draftId);
        if (remote.status === "COMMITTED" && remote.committedClipId && context.targetClipId === null) {
          onCommittedRecovery(remote.committedClipId); return;
        }
        remote = null; local = null;
      }
      // A clean browser cache never wins over a newer server working copy.
      if (local && !local.dirty && !local.pending && remote?.status === "ACTIVE") local = null;
      opened = new DraftSession({ context, content, baseClip, storage, server: remote, local,
        save: (request, draftId) => {
          if (getCurrentUserId() !== context.userId) throw new Error("로그인 계정이 변경되었습니다.");
          return saveEditorDraft(context.projectId, context.trackId, draftId, request);
        } });
      setSession(opened);
      setRestored(Boolean(local?.dirty || local?.pending || remote));
    })().catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "초안을 불러오지 못했습니다."); });
    return () => { cancelled = true; opened?.dispose(); };
  }, [context, content, baseClip, enabled, loadRevision, onCommittedRecovery]);

  useEffect(() => {
    if (!session || state?.status !== "dirty") return;
    const timer = window.setTimeout(() => { void session.flush().catch(() => {}); }, 1000);
    return () => window.clearTimeout(timer);
  }, [session, state]);

  useEffect(() => {
    if (!session) return;
    const flush = () => {
      const state = session.getSnapshot();
      if (state.hasUnsavedChanges && state.retryable && state.status !== "conflict") void session.flush().catch(() => {});
    };
    const timer = window.setInterval(flush, 5000);
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === draftStorageKey(context)) session.suspend("다른 탭에서 작업이 변경되었습니다. 어느 작업을 이어갈지 선택해 주세요.");
    };
    window.addEventListener("online", flush);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(timer); window.removeEventListener("online", flush);
      window.removeEventListener("storage", storageChanged); document.removeEventListener("visibilitychange", hidden);
    };
  }, [session, context]);

  useEffect(() => {
    if (!state?.hasUnsavedChanges || state.localProtected) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state?.hasUnsavedChanges, state?.localProtected]);

  return {
    session, state, restored, loadError,
    async commit() {
      if (!session) throw new Error("초안을 불러오는 중입니다.");
      session.freeze(true);
      try {
        const saved = await session.flush();
        if (!saved) return null;
        if (getCurrentUserId() !== context.userId) throw new Error("로그인 계정이 변경되었습니다.");
        const committed = await commitEditorDraft(context.projectId, saved.draftId, saved.revision);
        removeLocalDraft(browserDraftStorage(), context, saved.draftId, committed.content);
        return committed;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) session.suspend(error.message);
        throw error;
      } finally { session.freeze(false); }
    },
    async discard() {
      if (!session) return;
      session.freeze(true);
      try {
        await session.waitForPending().catch(() => {});
        const local = session.getLocalRecord();
        let remote: ServerDraft | null = null;
        try { remote = await getEditorDraft(context.projectId, local.draftId); }
        catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
        if (remote?.status === "ACTIVE") {
          if (remote.revision !== local.serverRevision && remote.mutationId !== local.pending?.mutationId) {
            throw new ApiError(409, "다른 기기에서 초안이 변경되었습니다. 최신 작업을 확인한 뒤 버려 주세요.");
          }
          await discardEditorDraft(context.projectId, remote.draftId, remote.revision);
        }
        removeLocalDraft(browserDraftStorage(), context, local.draftId);
        session.dispose();
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) session.suspend(error.message);
        throw error;
      } finally { session.freeze(false); }
    },
    async keepLocal() {
      if (!session) return;
      const drafts = await getEditorDrafts(context.projectId);
      const remote = drafts.find(d => d.trackId === context.trackId && d.targetClipId === context.targetClipId) ?? null;
      // Check the receipt too: a stale tab must not turn a committed new clip into a duplicate.
      if (!remote) {
        try {
          const receipt = await getEditorDraft(context.projectId, session.getLocalRecord().draftId);
          if (receipt.status !== "ACTIVE") throw new Error("이 작업은 이미 반영되거나 버려졌습니다. 복구본을 다운로드한 뒤 서버 작업을 열어 주세요.");
        } catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
      }
      session.keepLocal(remote);
      await session.flush();
    },
    async useServer() {
      if (!session) return;
      const local = session.getLocalRecord();
      let receipt: ServerDraft | null = null;
      try { receipt = await getEditorDraft(context.projectId, local.draftId); }
      catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
      removeLocalDraft(browserDraftStorage(), context, local.draftId);
      session.dispose(); setSession(null); setLoadError(null);
      if (receipt?.status === "COMMITTED" && receipt.committedClipId && context.targetClipId === null) {
        onCommittedRecovery(receipt.committedClipId); return;
      }
      reload(value => value + 1);
    },
    retryLoad() { setLoadError(null); reload(value => value + 1); },
  };
}

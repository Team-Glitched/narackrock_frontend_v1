import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { validatePostImage } from "@/features/community/post-image";
import { sourceError } from "@/features/sources/source-screens";
import { apiOrigin } from "@/lib/api/client";
import { uploadMedia } from "@/lib/api/media";
import {
  deleteOpenSource,
  getMyOpenSourcePublication,
  listMyOpenSourcePublications,
  setOpenSourceVisibility,
  updateOpenSource,
  type OpenSourcePublication,
} from "@/lib/api/open-sources";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { workspaceStyles } from "@/styles/workspace.styles";

type PublicationList = {
  items: OpenSourcePublication[];
  page: number;
  hasNext: boolean;
  loaded: boolean;
  loading: boolean;
  error: string;
};
type PublicationEditor = {
  source: OpenSourcePublication;
  title: string;
  description: string;
  thumbnail: "keep" | "remove" | "replace";
  file: File | null;
};
type BusyAction = { kind: "manage" | "save" | "visibility" | "delete"; id: number };

/** Owner metadata is available for both PRIVATE and PUBLIC sources without requesting public detail. */
export function SourcePublications({ onOpen }: { onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>내 등록 오픈소스는 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <PublicationListManager key={JSON.stringify([apiOrigin(), userId])} onOpen={onOpen} />;
}

function PublicationListManager({ onOpen }: { onOpen: (id: number) => void }) {
  const [list, setList] = useState<PublicationList>({
    items: [], page: -1, hasNext: false, loaded: false, loading: true, error: "",
  });
  const [editor, setEditor] = useState<PublicationEditor | null>(null);
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const active = useRef(false);
  const generation = useRef(0);
  const listLock = useRef(false);
  const mutationLock = useRef(false);
  const uploadedThumbnail = useRef<{ file: File; id: number } | null>(null);
  const formId = useId();
  const deleteTitleId = useId();

  const loadPage = useCallback(async (page: number) => {
    if (!active.current || listLock.current || mutationLock.current) return;
    listLock.current = true;
    const token = generation.current;
    const current = () => active.current && generation.current === token;
    try {
      const result = await listMyOpenSourcePublications(page);
      if (!current()) return;
      setList((old) => {
        const previous = old.items;
        const seen = new Set(previous.map((item) => item.openSourceId));
        const added = result.items.filter((item) => {
          if (seen.has(item.openSourceId)) return false;
          seen.add(item.openSourceId);
          return true;
        });
        return { items: [...previous, ...added], page, hasNext: result.hasNext, loaded: true, loading: false, error: "" };
      });
    } catch (cause) {
      if (current()) setList((old) => ({ ...old, loading: false, error: sourceError(cause, "내 등록 오픈소스를 불러오지 못했습니다.") }));
    } finally {
      if (current()) listLock.current = false;
    }
  }, []);

  useEffect(() => {
    active.current = true;
    generation.current += 1;
    void loadPage(0);
    return () => {
      active.current = false;
      generation.current += 1;
      listLock.current = false;
      mutationLock.current = false;
    };
  }, [loadPage]);

  function requestPage(page: number) {
    if (!active.current || listLock.current || mutationLock.current) return;
    setList((old) => ({ ...old, loading: true, error: "" }));
    void loadPage(page);
  }

  async function runAction(
    action: BusyAction,
    fallback: string,
    request: (current: () => boolean) => Promise<void>,
    reportError: (message: string) => void = setNotice,
  ) {
    // State alone cannot prevent two clicks before React renders the disabled button.
    if (!active.current || mutationLock.current || listLock.current) return;
    mutationLock.current = true;
    const token = generation.current;
    const current = () => active.current && generation.current === token;
    setBusy(action);
    setNotice("");
    reportError("");
    try {
      await request(current);
    } catch (cause) {
      if (current()) reportError(sourceError(cause, fallback));
    } finally {
      if (current()) {
        mutationLock.current = false;
        setBusy(null);
      }
    }
  }

  function manage(id: number) {
    void runAction({ kind: "manage", id }, "등록 정보를 불러오지 못했습니다.", async (current) => {
      const source = await getMyOpenSourcePublication(id);
      if (!current()) return;
      setList((old) => ({ ...old, items: old.items.map((item) => item.openSourceId === source.openSourceId ? source : item) }));
      uploadedThumbnail.current = null;
      setEditorError("");
      setEditor({ source, title: source.title, description: source.description ?? "", thumbnail: "keep", file: null });
    });
  }

  function closeEditor() {
    if (mutationLock.current) return;
    setEditor(null);
    setEditorError("");
    setConfirmDelete(false);
    uploadedThumbnail.current = null;
  }

  function save() {
    if (!editor || mutationLock.current) return;
    const working = editor;
    const title = working.title.trim();
    if (Array.from(title).length < 1 || Array.from(title).length > 100 || Array.from(working.description).length > 2000) {
      setEditorError("제목은 1~100자, 설명은 2000자 이내로 입력해 주세요.");
      return;
    }
    if (working.thumbnail === "replace" && !working.file) {
      setEditorError("새 썸네일 이미지를 선택해 주세요.");
      return;
    }
    void runAction({ kind: "save", id: working.source.openSourceId }, "등록 정보를 저장하지 못했습니다.", async (current) => {
      const patch: Parameters<typeof updateOpenSource>[1] = { title, description: working.description };
      if (working.thumbnail === "remove") patch.thumbnailMediaFileId = null;
      if (working.thumbnail === "replace" && working.file) {
        validatePostImage(working.file);
        const cached = uploadedThumbnail.current;
        const id = cached?.file === working.file ? cached.id : await uploadMedia(working.file, "IMAGE");
        // Do not PATCH the previous account after a delayed upload completes.
        if (!current()) return;
        uploadedThumbnail.current = { file: working.file, id };
        patch.thumbnailMediaFileId = id;
      }
      // Source audio is immutable here: this PATCH never includes mediaFileId or visibility.
      const source = await updateOpenSource(working.source.openSourceId, patch);
      if (!current()) return;
      setList((old) => ({ ...old, items: old.items.map((item) => item.openSourceId === source.openSourceId ? source : item) }));
      setEditor(null);
      uploadedThumbnail.current = null;
      setNotice("등록 정보를 저장했습니다.");
    }, setEditorError);
  }

  function toggleVisibility(source: OpenSourcePublication) {
    void runAction({ kind: "visibility", id: source.openSourceId }, "공개 상태를 변경하지 못했습니다.", async (current) => {
      const result = await setOpenSourceVisibility(source.openSourceId, source.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC");
      if (!current()) return;
      setList((old) => ({ ...old, items: old.items.map((item) => item.openSourceId === result.openSourceId ? { ...item, visibility: result.visibility } : item) }));
    });
  }

  function remove() {
    if (!editor) return;
    const id = editor.source.openSourceId;
    void runAction({ kind: "delete", id }, "오픈소스를 삭제하지 못했습니다.", async (current) => {
      const result = await deleteOpenSource(id);
      if (!current()) return;
      if (!result.isDeleted || result.openSourceId !== id) throw new Error("오픈소스가 삭제되지 않았습니다.");
      setList((old) => ({
        ...old,
        items: old.items.filter((item) => item.openSourceId !== id),
        // Offset pages shift after deletion; reread an overlap before advancing.
        // Repeated deletes rewind again, while append deduplication retains loaded rows.
        page: old.hasNext ? Math.max(-1, old.page - 1) : old.page,
      }));
      setEditor(null);
      setConfirmDelete(false);
      uploadedThumbnail.current = null;
      setNotice("오픈소스를 삭제했습니다.");
    }, setDeleteError);
  }

  return (
    <section aria-label="내 등록 오픈소스" className={cn(workspaceStyles.workspacePage, sharedStyles.scrollContent)}>
      {notice && <p role="status" className={workspaceStyles.workspaceNotice}>{notice}</p>}
      {editor ? (
        <form className={cn(workspaceStyles.workspaceCard, workspaceStyles.workspaceReview)} onSubmit={(event) => { event.preventDefault(); save(); }}>
          <h2>등록 관리</h2>
          <p>공개 상태: {editor.source.visibility === "PUBLIC" ? "공개" : "비공개"}. 원본 음원은 변경되지 않습니다.</p>
          <fieldset disabled={busy !== null} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <label>
              제목
              <input className="w-full rounded-[10px] bg-app-surface p-3 text-body" value={editor.title} aria-describedby={`${formId}-title-count`}
                onChange={(event) => setEditor((old) => old ? { ...old, title: event.target.value } : old)} />
            </label>
            <small id={`${formId}-title-count`}>{Array.from(editor.title.trim()).length}/100자 · 필수</small>
            <label>
              설명 (선택)
              <textarea value={editor.description} rows={4} aria-describedby={`${formId}-description-count`}
                onChange={(event) => setEditor((old) => old ? { ...old, description: event.target.value } : old)} />
            </label>
            <small id={`${formId}-description-count`}>{Array.from(editor.description).length}/2000자</small>
            <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend>썸네일</legend>
              <label><span><input type="radio" name={`${formId}-thumbnail`} checked={editor.thumbnail === "keep"} onChange={() => setEditor((old) => old ? { ...old, thumbnail: "keep" } : old)} /> 현재 썸네일 유지{editor.source.thumbnailMediaFileId === null ? " (없음)" : ""}</span></label>
              <label><span><input type="radio" name={`${formId}-thumbnail`} checked={editor.thumbnail === "replace"} onChange={() => setEditor((old) => old ? { ...old, thumbnail: "replace" } : old)} /> 새 이미지로 변경</span></label>
              <label>
                새 썸네일 이미지 (JPG, PNG, WEBP, GIF · 최대 100MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="w-full min-w-0 text-body"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      validatePostImage(file);
                      uploadedThumbnail.current = null;
                      setEditorError("");
                      setEditor((old) => old ? { ...old, thumbnail: "replace", file } : old);
                    } catch (cause) {
                      setEditorError(cause instanceof Error ? cause.message : "이미지를 선택하지 못했습니다.");
                    }
                  }} />
              </label>
              {editor.file && <p>선택한 이미지: {editor.file.name}</p>}
              <label><span><input type="radio" name={`${formId}-thumbnail`} checked={editor.thumbnail === "remove"} onChange={() => setEditor((old) => old ? { ...old, thumbnail: "remove" } : old)} /> 썸네일 삭제</span></label>
            </fieldset>
          </fieldset>
          {editorError && <p role="alert" className={workspaceStyles.workspaceNotice}>{editorError}</p>}
          <div className={workspaceStyles.workspaceActions}>
            <button type="submit" className={workspaceStyles.workspacePrimary} disabled={busy !== null}>{busy?.kind === "save" ? "저장 중..." : "저장"}</button>
            <button type="button" onClick={closeEditor} disabled={busy !== null}>취소 / 목록으로</button>
            <button type="button" disabled={busy !== null} onClick={() => { if (mutationLock.current) return; setDeleteError(""); setConfirmDelete(true); }}>오픈소스 삭제</button>
          </div>
        </form>
      ) : (
        <>
          {list.loading && <p role="status">내 등록 오픈소스를 불러오는 중...</p>}
          {list.error && <div role="alert" className={workspaceStyles.workspaceNotice}>
            <p>{list.error}</p>
            <button className={buttonVariants({ tone: "secondary", size: "compact" })} disabled={list.loading || busy !== null} onClick={() => requestPage(list.loaded ? list.page + 1 : 0)}>다시 시도</button>
          </div>}
          {list.loaded && !list.loading && !list.error && list.items.length === 0 && <p className={workspaceStyles.workspaceEmpty}>아직 등록한 오픈소스가 없습니다.</p>}
          {list.items.map((source) => (
            <article key={source.openSourceId} className={workspaceStyles.workspaceCard}>
              <span className={workspaceStyles.workspaceStatus}>{source.visibility === "PUBLIC" ? "공개" : "비공개"}</span>
              <h2>{source.title}</h2>
              <p className="whitespace-pre-wrap">{source.description ?? ""}</p>
              <div className={workspaceStyles.workspaceActions}>
                <button disabled={busy !== null || list.loading} onClick={() => manage(source.openSourceId)}>{busy?.kind === "manage" && busy.id === source.openSourceId ? "불러오는 중..." : "관리"}</button>
                <button disabled={busy !== null || list.loading} onClick={() => toggleVisibility(source)}>{busy?.kind === "visibility" && busy.id === source.openSourceId ? "변경 중..." : source.visibility === "PUBLIC" ? "비공개로 전환" : "공개하기"}</button>
                {source.visibility === "PUBLIC" && <button disabled={busy !== null} className={workspaceStyles.workspacePrimary} onClick={() => onOpen(source.openSourceId)}>자세히 보기</button>}
              </div>
            </article>
          ))}
          {list.hasNext && !list.error && <div className={workspaceStyles.workspaceActions}>
            <button disabled={list.loading || busy !== null} onClick={() => requestPage(list.page + 1)}>{list.loading ? "불러오는 중..." : "더보기"}</button>
          </div>}
        </>
      )}
      {confirmDelete && editor && <CanvasDialog className={sharedStyles.creationDiscardDialog} titleId={deleteTitleId} onClose={() => { if (!mutationLock.current) setConfirmDelete(false); }}>
        <h2 id={deleteTitleId}>오픈소스를 삭제할까요?</h2>
        <p>“{editor.source.title}”을 삭제하면 되돌릴 수 없습니다.</p>
        {deleteError && <p role="alert">{deleteError}</p>}
        <div>
          <button type="button" className={buttonVariants({ tone: "secondary" })} disabled={busy !== null} onClick={() => setConfirmDelete(false)}>취소</button>
          <button type="button" className={buttonVariants({ tone: "primary" })} disabled={busy !== null} onClick={remove}>{busy?.kind === "delete" ? "삭제 중..." : deleteError ? "삭제 다시 시도" : "삭제 확인"}</button>
        </div>
      </CanvasDialog>}
    </section>
  );
}

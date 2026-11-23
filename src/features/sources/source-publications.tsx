import { useId, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { CanvasDialog } from "@/components/canvas-dialog";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { validatePostImage } from "@/features/community/post-image";
import { sourceError } from "@/features/sources/source-screens";
import { sourceKeys, sourcePublicationsQuery } from "@/features/sources/source-queries";
import { SessionChangedError, apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { uploadMedia } from "@/lib/api/media";
import {
  deleteOpenSource,
  getMyOpenSourcePublication,
  setOpenSourceVisibility,
  updateOpenSource,
  type OpenSourcePage,
  type OpenSourcePublication,
} from "@/lib/api/open-sources";
import { cn } from "@/lib/utils";
import {
  SOURCE_DESCRIPTION_MAX_LENGTH,
  SOURCE_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "@/lib/content-limits";
import { sharedStyles } from "@/styles/shared.styles";
import { sourceStyles } from "@/styles/source.styles";
import { buttonVariants } from "@/styles/variants";
import { workspaceStyles } from "@/styles/workspace.styles";

type PublicationEditor = {
  source: OpenSourcePublication;
  title: string;
  description: string;
  thumbnail: "keep" | "remove" | "replace";
  file: File | null;
};
type BusyAction = { kind: "manage" | "save" | "visibility" | "delete"; id: number };
type PublicationPages = InfiniteData<OpenSourcePage<OpenSourcePublication>, number>;

/** Owner metadata is available for both PRIVATE and PUBLIC sources without requesting public detail. */
export function SourcePublications({ onOpen }: { onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  if (userId === null)
    return <SignInRequired>내 등록 샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <PublicationListManager key={JSON.stringify([apiOrigin(), userId])} onOpen={onOpen} />;
}

/**
 * The owner's samples (내 등록) and their 등록 관리 form: list paging, the editor, visibility changes and
 * deletion with its confirmation. Used by the web list and the app's native 내 등록 tab.
 */
export function useSourcePublications() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const list = useInfiniteQuery(sourcePublicationsQuery(userId));
  const [editor, setEditor] = useState<PublicationEditor | null>(null);
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const uploadedThumbnail = useRef<{ file: File; id: number } | null>(null);
  const publicationsKey = sourceKeys.publications(userId);

  // Offset pages can repeat a row after the list shifted; each source is shown once.
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (list.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => {
        if (seen.has(item.openSourceId)) return false;
        seen.add(item.openSourceId);
        return true;
      });
  }, [list.data]);
  const loading = (list.isFetching && !list.data) || list.isFetchingNextPage;
  const listError =
    list.error && !loading ? sourceError(list.error, "내 등록 샘플을 불러오지 못했습니다.") : "";

  function replaceItem(
    source: Pick<OpenSourcePublication, "openSourceId"> & Partial<OpenSourcePublication>,
  ) {
    queryClient.setQueryData<PublicationPages>(
      publicationsKey,
      (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.openSourceId === source.openSourceId ? { ...item, ...source } : item,
            ),
          })),
        },
    );
  }
  /** Public listings, the public detail and saved libraries show what an owner edit changed. */
  function invalidatePublic(sourceId: number) {
    void queryClient.invalidateQueries({ queryKey: sourceKeys.lists(userId) });
    void queryClient.invalidateQueries({ queryKey: sourceKeys.popular(userId) });
    void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(userId, sourceId) });
    void queryClient.invalidateQueries({ queryKey: sourceKeys.saved(userId) });
  }

  const manage = useMutation({
    mutationKey: publicationsKey,
    mutationFn: (id: number) => getMyOpenSourcePublication(id),
    onSuccess: replaceItem,
  });
  const save = useMutation({
    mutationKey: publicationsKey,
    mutationFn: async ({ working, title }: { working: PublicationEditor; title: string }) => {
      const patch: Parameters<typeof updateOpenSource>[1] = {
        title,
        description: working.description,
      };
      if (working.thumbnail === "remove") patch.thumbnailMediaFileId = null;
      if (working.thumbnail === "replace" && working.file) {
        validatePostImage(working.file);
        const cached = uploadedThumbnail.current;
        const id =
          cached?.file === working.file ? cached.id : await uploadMedia(working.file, "IMAGE");
        // Do not PATCH the previous account after a delayed upload completes.
        if (getCurrentUserId() !== userId) throw new SessionChangedError();
        uploadedThumbnail.current = { file: working.file, id };
        patch.thumbnailMediaFileId = id;
      }
      // Source audio is immutable here: this PATCH never includes mediaFileId or visibility.
      return updateOpenSource(working.source.openSourceId, patch);
    },
    onSuccess: (source) => {
      replaceItem(source);
      invalidatePublic(source.openSourceId);
    },
  });
  const visibility = useMutation({
    mutationKey: publicationsKey,
    mutationFn: (source: OpenSourcePublication) =>
      setOpenSourceVisibility(
        source.openSourceId,
        source.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
      ),
    onSuccess: (result) => {
      replaceItem(result);
      invalidatePublic(result.openSourceId);
    },
  });
  const deletion = useMutation({
    mutationKey: publicationsKey,
    mutationFn: async (id: number) => {
      const result = await deleteOpenSource(id);
      if (!result.isDeleted || result.openSourceId !== id)
        throw new Error("샘플이 삭제되지 않았습니다.");
      return result;
    },
    onSuccess: ({ openSourceId }) => {
      queryClient.setQueryData<PublicationPages>(
        publicationsKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.openSourceId !== openSourceId),
            })),
          },
      );
      // Offset pages shift after deletion: every loaded page is reread so the row moved across a boundary is not skipped.
      void queryClient.invalidateQueries({ queryKey: publicationsKey });
      queryClient.removeQueries({ queryKey: sourceKeys.detail(userId, openSourceId) });
      void queryClient.invalidateQueries({ queryKey: sourceKeys.lists(userId) });
      void queryClient.invalidateQueries({ queryKey: sourceKeys.popular(userId) });
      void queryClient.invalidateQueries({ queryKey: sourceKeys.saved(userId) });
    },
  });
  const busy: BusyAction | null = manage.isPending
    ? { kind: "manage", id: manage.variables }
    : save.isPending
      ? { kind: "save", id: save.variables.working.source.openSourceId }
      : visibility.isPending
        ? { kind: "visibility", id: visibility.variables.openSourceId }
        : deletion.isPending
          ? { kind: "delete", id: deletion.variables }
          : null;
  // Render state alone cannot prevent two clicks before React renders the disabled button.
  const writing = () => queryClient.isMutating({ mutationKey: publicationsKey }) > 0;

  function requestPage() {
    if (writing() || list.isFetching) return;
    if (list.isFetchNextPageError || (list.data && list.hasNextPage && !list.error))
      void list.fetchNextPage();
    else void list.refetch();
  }

  function manageSource(id: number) {
    if (writing() || list.isFetching) return;
    setNotice("");
    manage.mutate(id, {
      onSuccess: (source) => {
        uploadedThumbnail.current = null;
        setEditorError("");
        setEditor({
          source,
          title: source.title,
          description: source.description ?? "",
          thumbnail: "keep",
          file: null,
        });
      },
      onError: (cause) => setNotice(sourceError(cause, "등록 정보를 불러오지 못했습니다.")),
    });
  }

  function closeEditor() {
    if (writing()) return;
    setEditor(null);
    setEditorError("");
    setConfirmDelete(false);
    uploadedThumbnail.current = null;
  }

  function submit() {
    if (!editor || writing()) return;
    const working = editor;
    const title = working.title.trim();
    if (
      codePointLength(title) < 1 ||
      codePointLength(title) > SOURCE_TITLE_MAX_LENGTH ||
      codePointLength(working.description) > SOURCE_DESCRIPTION_MAX_LENGTH
    ) {
      setEditorError(
        `제목은 1~${SOURCE_TITLE_MAX_LENGTH}자, 설명은 ${SOURCE_DESCRIPTION_MAX_LENGTH}자 이내로 입력해 주세요.`,
      );
      return;
    }
    if (working.thumbnail === "replace" && !working.file) {
      setEditorError("새 썸네일 이미지를 선택해 주세요.");
      return;
    }
    setNotice("");
    setEditorError("");
    save.mutate(
      { working, title },
      {
        onSuccess: () => {
          setEditor(null);
          uploadedThumbnail.current = null;
          setNotice("등록 정보를 저장했습니다.");
        },
        onError: (cause) => setEditorError(sourceError(cause, "등록 정보를 저장하지 못했습니다.")),
      },
    );
  }

  function toggleVisibility(source: OpenSourcePublication) {
    if (writing() || list.isFetching) return;
    setNotice("");
    visibility.mutate(source, {
      onError: (cause) => setNotice(sourceError(cause, "공개 상태를 변경하지 못했습니다.")),
    });
  }

  function remove() {
    if (!editor || writing()) return;
    setNotice("");
    setDeleteError("");
    deletion.mutate(editor.source.openSourceId, {
      onSuccess: () => {
        setEditor(null);
        setConfirmDelete(false);
        uploadedThumbnail.current = null;
        setNotice("샘플을 삭제했습니다.");
      },
      onError: (cause) => setDeleteError(sourceError(cause, "샘플을 삭제하지 못했습니다.")),
    });
  }

  /** A new thumbnail file ("새 썸네일 이미지"): validated, then it replaces the current one. */
  function pickThumbnail(file: File) {
    try {
      validatePostImage(file);
      uploadedThumbnail.current = null;
      setEditorError("");
      setEditor((old) => (old ? { ...old, thumbnail: "replace", file } : old));
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "이미지를 선택하지 못했습니다.");
    }
  }

  /** "샘플 삭제": opens the confirmation. */
  function openDelete() {
    if (writing()) return;
    setDeleteError("");
    setConfirmDelete(true);
  }

  return {
    list,
    items,
    loading,
    listError,
    editor,
    setEditor,
    editorError,
    notice,
    busy,
    writing,
    requestPage,
    manageSource,
    toggleVisibility,
    closeEditor,
    submit,
    pickThumbnail,
    confirmDelete,
    setConfirmDelete,
    deleteError,
    openDelete,
    remove,
  };
}

function PublicationListManager({ onOpen }: { onOpen: (id: number) => void }) {
  const {
    list,
    items,
    loading,
    listError,
    editor,
    setEditor,
    editorError,
    notice,
    busy,
    writing,
    requestPage,
    manageSource,
    toggleVisibility,
    closeEditor,
    submit,
    pickThumbnail,
    confirmDelete,
    setConfirmDelete,
    deleteError,
    openDelete,
    remove,
  } = useSourcePublications();
  const formId = useId();
  const deleteTitleId = useId();
  return (
    <section
      aria-label="내 등록 샘플"
      className={cn(
        workspaceStyles.workspacePage,
        sourceStyles.libraryPage,
        sharedStyles.scrollContent,
      )}
    >
      {!editor && <h1>내 등록 샘플</h1>}
      {notice && (
        <p role="status" className={workspaceStyles.workspaceNotice}>
          {notice}
        </p>
      )}
      {editor ? (
        <form
          className={cn(
            workspaceStyles.workspaceCard,
            sourceStyles.libraryCard,
            workspaceStyles.workspaceReview,
          )}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <h2>등록 관리</h2>
          <p>
            공개 상태: {editor.source.visibility === "PUBLIC" ? "공개" : "비공개"}. 원본 음원은
            변경되지 않습니다.
          </p>
          <fieldset
            disabled={busy !== null}
            className="m-0 grid min-w-0 gap-2 border-0 p-0 [&>small]:text-caption [&>small]:text-app-muted"
          >
            <label>
              제목
              <input
                className="w-full rounded-[10px] bg-app-surface p-3 text-body"
                value={editor.title}
                aria-describedby={`${formId}-title-count`}
                onChange={(event) =>
                  setEditor((old) =>
                    old
                      ? {
                          ...old,
                          title: clampCodePoints(event.target.value, SOURCE_TITLE_MAX_LENGTH),
                        }
                      : old,
                  )
                }
              />
            </label>
            <small id={`${formId}-title-count`}>
              {codePointLength(editor.title.trim())}/{SOURCE_TITLE_MAX_LENGTH}자 · 필수
            </small>
            <label>
              설명 (선택)
              <textarea
                value={editor.description}
                rows={4}
                aria-describedby={`${formId}-description-count`}
                onChange={(event) =>
                  setEditor((old) =>
                    old
                      ? {
                          ...old,
                          description: clampCodePoints(
                            event.target.value,
                            SOURCE_DESCRIPTION_MAX_LENGTH,
                          ),
                        }
                      : old,
                  )
                }
              />
            </label>
            <small id={`${formId}-description-count`}>
              {codePointLength(editor.description)}/{SOURCE_DESCRIPTION_MAX_LENGTH}자
            </small>
            <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend>썸네일</legend>
              <label>
                <span>
                  <input
                    type="radio"
                    name={`${formId}-thumbnail`}
                    checked={editor.thumbnail === "keep"}
                    onChange={() => setEditor((old) => (old ? { ...old, thumbnail: "keep" } : old))}
                  />{" "}
                  현재 썸네일 유지{editor.source.thumbnailMediaFileId === null ? " (없음)" : ""}
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="radio"
                    name={`${formId}-thumbnail`}
                    checked={editor.thumbnail === "replace"}
                    onChange={() =>
                      setEditor((old) => (old ? { ...old, thumbnail: "replace" } : old))
                    }
                  />{" "}
                  새 이미지로 변경
                </span>
              </label>
              <label>
                새 썸네일 이미지 (JPG, PNG, WEBP, GIF · 최대 100MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="w-full min-w-0 text-body"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) pickThumbnail(file);
                  }}
                />
              </label>
              {editor.file && <p>선택한 이미지: {editor.file.name}</p>}
              <label>
                <span>
                  <input
                    type="radio"
                    name={`${formId}-thumbnail`}
                    checked={editor.thumbnail === "remove"}
                    onChange={() =>
                      setEditor((old) => (old ? { ...old, thumbnail: "remove" } : old))
                    }
                  />{" "}
                  썸네일 삭제
                </span>
              </label>
            </fieldset>
          </fieldset>
          {editorError && (
            <p role="alert" className={workspaceStyles.workspaceNotice}>
              {editorError}
            </p>
          )}
          <div className={cn(workspaceStyles.workspaceActions, sourceStyles.libraryActions)}>
            <button
              type="submit"
              className={workspaceStyles.workspacePrimary}
              disabled={busy !== null}
            >
              {busy?.kind === "save" ? "저장 중..." : "저장"}
            </button>
            <button type="button" onClick={closeEditor} disabled={busy !== null}>
              취소 / 목록으로
            </button>
            <button type="button" disabled={busy !== null} onClick={openDelete}>
              샘플 삭제
            </button>
          </div>
        </form>
      ) : (
        <>
          {loading && <p role="status">내 등록 샘플을 불러오는 중...</p>}
          {listError && (
            <div role="alert" className={workspaceStyles.workspaceNotice}>
              <p>{listError}</p>
              <button
                className={buttonVariants({ tone: "secondary", size: "compact" })}
                disabled={list.isFetching || busy !== null}
                onClick={requestPage}
              >
                다시 시도
              </button>
            </div>
          )}
          {list.data && !loading && !listError && items.length === 0 && (
            <p className={workspaceStyles.workspaceEmpty}>아직 등록한 샘플이 없습니다.</p>
          )}
          {items.map((source) => (
            <article
              key={source.openSourceId}
              className={cn(workspaceStyles.workspaceCard, sourceStyles.libraryCard)}
            >
              <span className={workspaceStyles.workspaceStatus}>
                {source.visibility === "PUBLIC" ? "공개" : "비공개"}
              </span>
              <h2>{source.title}</h2>
              {source.description && <p className="whitespace-pre-wrap">{source.description}</p>}
              <div className={cn(workspaceStyles.workspaceActions, sourceStyles.libraryActions)}>
                <button
                  disabled={busy !== null || list.isFetching}
                  onClick={() => manageSource(source.openSourceId)}
                >
                  {busy?.kind === "manage" && busy.id === source.openSourceId
                    ? "불러오는 중..."
                    : "관리"}
                </button>
                <button
                  disabled={busy !== null || list.isFetching}
                  onClick={() => toggleVisibility(source)}
                >
                  {busy?.kind === "visibility" && busy.id === source.openSourceId
                    ? "변경 중..."
                    : source.visibility === "PUBLIC"
                      ? "비공개로 전환"
                      : "공개하기"}
                </button>
                {source.visibility === "PUBLIC" && (
                  <button
                    disabled={busy !== null}
                    className={workspaceStyles.workspacePrimary}
                    onClick={() => onOpen(source.openSourceId)}
                  >
                    자세히 보기
                  </button>
                )}
              </div>
            </article>
          ))}
          {list.hasNextPage && !listError && (
            <div className={workspaceStyles.workspaceActions}>
              <button disabled={list.isFetching || busy !== null} onClick={requestPage}>
                {loading ? "불러오는 중..." : "더보기"}
              </button>
            </div>
          )}
        </>
      )}
      {confirmDelete && editor && (
        <CanvasDialog
          className={sharedStyles.creationDiscardDialog}
          titleId={deleteTitleId}
          onClose={() => {
            if (!writing()) setConfirmDelete(false);
          }}
        >
          <h2 id={deleteTitleId}>샘플을 삭제할까요?</h2>
          <p>“{editor.source.title}”을 삭제하면 되돌릴 수 없습니다.</p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <div>
            <button
              type="button"
              className={buttonVariants({ tone: "secondary" })}
              disabled={busy !== null}
              onClick={() => setConfirmDelete(false)}
            >
              취소
            </button>
            <button
              type="button"
              className={buttonVariants({ tone: "primary" })}
              disabled={busy !== null}
              onClick={remove}
            >
              {busy?.kind === "delete"
                ? "삭제 중..."
                : deleteError
                  ? "삭제 다시 시도"
                  : "삭제 확인"}
            </button>
          </div>
        </CanvasDialog>
      )}
    </section>
  );
}

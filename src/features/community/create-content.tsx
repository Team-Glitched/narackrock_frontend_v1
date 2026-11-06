import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import type { PostTargetStatus } from "@/features/community/post-target";
import { SourcePianoEditor } from "@/features/composition/source-piano-editor";
import type { MidiNoteDto } from "@/lib/api/composition";
import {
  CompositionChoiceScreen,
  CompositionUploadScreen,
  CompositionRecordScreen,
} from "../composition/creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getCurrentUserId } from "@/lib/api/client";
import {
  readCreationDraft,
  restoreCreationDraft,
  rememberCreationDraft,
  clearCreationDraft,
} from "@/features/community/creation-draft";
import { CanvasDialog } from "@/components/canvas-dialog";
import { createPost, proposeGallery } from "@/lib/api/community";
import { uploadMedia } from "@/lib/api/media";
import { validatePostImage } from "@/features/community/post-image";
import type { GalleryListItem } from "@/lib/api/contracts";
import { clearPendingPublication, getPendingSourceAudioId, getSourceDraftRevision, hasPendingPublication, publishSource, subscribeSourcePublication, withSourcePublicationLock } from "@/features/sources/publish-source";
import { sourceError } from "@/features/sources/source-screens";
import { ThumbnailCropper } from "@/features/sources/thumbnail-cropper";
import { defaultCrop, renderThumbnail, type ThumbnailCrop } from "@/features/sources/thumbnail-crop";
export function SocialCreate({
  onCancel,
  postTargetStatus = "ready",
  kind,
  galleryId,
  onCreated,
  audioStage = "details",
  onAudioStage,
}: {
  onCancel: () => void;
  postTargetStatus?: PostTargetStatus;
  audioStage?: "details" | "choose" | "upload" | "record" | "note";
  onAudioStage?: (stage: "details" | "choose" | "upload" | "record" | "note") => void;
  kind: "post" | "community" | "source";
  galleryId: number;
  onCreated: (gallery?: GalleryListItem) => void;
}) {
  const userId = getCurrentUserId();
  const [draftKey] = useState(() => `live:${userId ?? "guest"}:${kind}`);
  const readSourceRevision = () =>
    kind === "source" && userId !== null ? getSourceDraftRevision({ userId, draftKey }) : null;
  const [draftRevision] = useState(readSourceRevision);
  const draftStorageKey = draftRevision === null ? draftKey : JSON.stringify([draftKey, draftRevision]);
  const initial = readCreationDraft(draftStorageKey);
  const [restoring, setRestoring] = useState(true);
  const [discarding, setDiscarding] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const [storageError, setStorageError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const writes = useRef(0);
  const [pianoNotes, setPianoNotes] = useState<MidiNoteDto[]>(() => initial?.notes ?? []);
  const [pianoBpm, setPianoBpm] = useState(() => initial?.bpm ?? 120);
  const [title, setTitle] = useState(() => initial?.title ?? "");
  const [content, setContent] = useState(() => initial?.content ?? "");
  const [image, setImage] = useState<{ file: File; url: string } | null>(() =>
    initial?.image ? { file: initial.image, url: URL.createObjectURL(initial.image) } : null,
  );
  const [audio, setAudio] = useState<File | null>(() => initial?.audio ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceVisibility, setSourceVisibility] = useState<"PRIVATE" | "PUBLIC">(() => initial?.sourceVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC");
  const [imageCrop, setImageCrop] = useState<ThumbnailCrop>(() => initial?.imageCrop ?? defaultCrop());
  const [imageRestoreFailed, setImageRestoreFailed] = useState(false);
  const subscribeSourceDraft = useCallback((onChange: () => void) => {
    if (kind === "source" && userId !== null) {
      return subscribeSourcePublication({ userId, draftKey }, onChange);
    }
    return () => {};
  }, [kind, userId, draftKey]);
  const readSourceAudioId = () =>
    kind === "source" && userId !== null ? getPendingSourceAudioId({ userId, draftKey }) : null;
  const pendingAudioId = useSyncExternalStore(subscribeSourceDraft, readSourceAudioId, () => null);
  const currentRevision = useSyncExternalStore(subscribeSourceDraft, readSourceRevision, () => null);
  const draftExpired = draftRevision !== currentRevision;
  const sourceAudioLocked = pendingAudioId !== null;
  const draftValue = useMemo(
    () => ({ title, content, image: image?.file ?? null, audio, notes: pianoNotes, bpm: pianoBpm, sourceVisibility, imageCrop, imageRestoreFailed }),
    [title, content, image, audio, pianoNotes, pianoBpm, sourceVisibility, imageCrop, imageRestoreFailed],
  );
  const [savedDraft, setSavedDraft] = useState<typeof draftValue | null>(null);
  const draftSaving = !restoring && !discarding && !draftExpired && !storageError && savedDraft !== draftValue;
  useEffect(() => {
    let active = true;
    void restoreCreationDraft(draftStorageKey)
      .then((draft) => {
        if (!active || !draft) return;
        if ("restorationWarning" in draft && typeof draft.restorationWarning === "string")
          setRestoreError(draft.restorationWarning);
        setSourceVisibility(draft.sourceVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC");
        setTitle(draft.title);
        setContent(draft.content);
        setAudio(draft.audio);
        setPianoNotes(draft.notes);
        setPianoBpm(draft.bpm);
        setImage(draft.image ? { file: draft.image, url: URL.createObjectURL(draft.image) } : null);
        setImageCrop(draft.imageCrop ?? defaultCrop());
        setImageRestoreFailed(kind === "source" && draft.imageRestoreFailed === true);
      })
      .catch(() => {
        if (active) setRestoreError("첨부 파일을 복원하지 못했습니다. 다시 첨부해주세요.");
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [draftStorageKey, kind]);
  useEffect(() => {
    if (restoring || discarding || draftExpired) return;
    if (kind === "source" && userId !== null && getSourceDraftRevision({ userId, draftKey }) !== draftRevision) return;
    const revision = ++writes.current;
    void rememberCreationDraft(draftStorageKey, draftValue)
      .then(() => {
        if (writes.current === revision) {
          setStorageError("");
          setSavedDraft(draftValue);
        }
      })
      .catch((cause) => {
        if (writes.current === revision) {
          setStorageError(cause instanceof Error ? cause.message : "초안을 저장하지 못했습니다.");
        }
      });
  }, [draftKey, draftStorageKey, draftValue, restoring, discarding, draftExpired, draftRevision, kind, userId]);
  useEffect(() => {
    if (!draftSaving) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [draftSaving]);
  const setAudioStage = (stage: "details" | "choose" | "upload" | "record" | "note") =>
    onAudioStage?.(stage);
  function saveSelectedAudio(file: File) {
    if (readSourceAudioId() === null) setAudio(file);
    setAudioStage("details");
  }
  async function selectAudio(file: File, selection?: AudioSelection) {
    setRestoreError("");
    const { wav } = await prepareAudioFile(file, selection);
    saveSelectedAudio(new File([wav], "opensource.wav", { type: "audio/wav" }));
  }
  function pickImage(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      validatePostImage(file);
      setRestoreError("");
      setImage({ file, url: URL.createObjectURL(file) });
      setImageRestoreFailed(false);
      // A new picture starts centred; a framing chosen for the previous one would not fit it.
      setImageCrop(defaultCrop());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다.");
    }
  }
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      busy ||
      draftExpired ||
      !title.trim() ||
      imageRestoreFailed ||
      (kind !== "source" && !content.trim()) ||
      (kind === "post" && postTargetStatus !== "ready")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "post") {
        const imageId = image ? await uploadMedia(image.file, "IMAGE") : null;
        await createPost(galleryId, title.trim(), content.trim(), imageId);
        setDiscarding(true);
        clearCreationDraft(draftKey);
        onCreated();
      } else if (kind === "source") {
        const userId = getCurrentUserId();
        if (userId === null) throw new Error("로그인 후 오픈소스를 등록할 수 있습니다.");
        if (!audio && !sourceAudioLocked) throw new Error("오디오를 먼저 선택해주세요.");
        if ([...title.trim()].length > 100 || [...content].length > 2000)
          throw new Error("오픈소스 이름은 100자, 설명은 2000자 이내로 입력해주세요.");
        try {
          await withSourcePublicationLock({ userId, draftKey, draftRevision }, async () => {
            // The original stays in the draft; only the framed thumbnail is uploaded.
            const thumbnail = image ? await renderThumbnail(image.file, imageCrop) : null;
            await publishSource({ userId, draftKey, title: title.trim(), description: content.trim() || null, audio, expectedPendingAudioId: pendingAudioId, image: thumbnail, visibility: sourceVisibility });
            setDiscarding(true);
            clearCreationDraft(draftStorageKey);
          });
        } catch (cause) {
          const message = sourceError(cause, "오픈소스를 등록하지 못했습니다.");
          throw new Error(
            hasPendingPublication({ userId, draftKey })
              ? `오픈소스 등록 기록이 있습니다. 다시 시도하면 같은 등록에서 선택한 공개 설정으로 이어서 저장합니다. (${message})`
              : message,
          );
        }
        onCreated();
      } else if (kind === "community") {
        if (getCurrentUserId() === null) throw new Error("로그인 후 커뮤니티 개설을 신청할 수 있습니다.");
        await proposeGallery(title.trim(), content.trim());
        setDiscarding(true);
        clearCreationDraft(draftKey);
        onCreated();
      } else throw new Error("현재 이 생성 기능을 사용할 수 없습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "생성하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  if (restoring)
    return (
      <p className={sharedStyles.creationRestoreStatus} role="status">
        작성 중인 내용을 불러오는 중...
      </p>
    );
  if (draftExpired && !busy)
    return (
      <p className={sharedStyles.creationRestoreStatus} role="status">
        다른 탭에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요.
      </p>
    );
  if (kind === "source" && audioStage !== "details" && !sourceAudioLocked)
    return (
      <div className={sharedStyles.sourceAudioFlow}>
        {audioStage === "choose" ? (
          <CompositionChoiceScreen
            busy={false}
            error={null}
            onBack={() => setAudioStage("details")}
            onChoose={(method) => setAudioStage(method)}
          />
        ) : audioStage === "upload" ? (
          <CompositionUploadScreen
            saveLabel="오디오 선택 완료"
            onBack={() => setAudioStage("choose")}
            onSave={selectAudio}
          />
        ) : audioStage === "note" ? (
          <SourcePianoEditor
            notes={pianoNotes}
            setNotes={setPianoNotes}
            bpm={pianoBpm}
            onBpm={setPianoBpm}
            onBack={() => setAudioStage("choose")}
            onSave={saveSelectedAudio}
          />
        ) : (
          <CompositionRecordScreen
            saveLabel="녹음 선택 완료"
            onBack={() => setAudioStage("choose")}
            onSave={selectAudio}
          />
        )}
      </div>
    );
  return (
    <form
      className={cn(communityStyles.socialCreateView, sharedStyles.scrollContent)}
      onSubmit={submit}
      aria-label={
        kind === "post" ? "게시글 작성" : kind === "community" ? "커뮤니티 생성" : "오픈소스 생성"
      }
    >
      <div className={communityStyles.socialCreateFields}>
        <label>
          {kind === "post" ? "제목" : kind === "community" ? "커뮤니티 이름" : "오픈소스 이름"}
          <input
            aria-label={
              kind === "post"
                ? "게시글 제목"
                : kind === "community"
                  ? "커뮤니티 이름"
                  : "오픈소스 이름"
            }
            disabled={busy}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={kind === "source" ? undefined : 100}
            required
          />
        </label>
        <label>
          {kind === "post" ? "본문" : "설명"}
          <textarea
            aria-label={kind === "post" ? "게시글 내용" : "설명"}
            disabled={busy}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required={kind !== "source"}
            rows={1}
          />
        </label>
        {kind === "source" && (
          <label>
            오디오
            <button
              type="button"
              disabled={busy || sourceAudioLocked}
              className={sharedStyles.sourceAudioSelect}
              onClick={() => setAudioStage("choose")}
            >
              {sourceAudioLocked ? "업로드한 오디오 사용" : audio ? "오디오 선택됨 · 다시 선택" : "오디오 추가"}
            </button>
            {sourceAudioLocked && (
              <span className={sharedStyles.creationSaveStatus}>
                등록 재시도에는 이미 업로드한 오디오를 사용합니다. 다른 오디오를 등록하려면 작성 취소 후 새로 작성해주세요.
              </span>
            )}
          </label>
        )}
        {kind === "community" ? (
          <p className={sharedStyles.creationSaveStatus}>
            커뮤니티 프로필 사진은 현재 서버에서 지원하지 않습니다. 이름과 설명으로 개설을 신청하면 관리자 승인 후 커뮤니티가 만들어집니다.
          </p>
        ) : kind === "source" && image ? (
          // Not inside a <label>: a click or drag in the editor must not reopen the file picker.
          <div className="flex flex-col gap-[10px] text-label font-bold text-app-fg">
            앨범
            <ThumbnailCropper file={image.file} crop={imageCrop} onChange={setImageCrop} disabled={busy} />
            <div className="flex justify-center gap-4 text-body font-medium text-app-muted">
              <label className="relative cursor-pointer underline">
                다른 이미지 선택
                <input
                  aria-label="다른 앨범 이미지 선택"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={busy}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => pickImage(event.target)}
                />
              </label>
              <button type="button" className="underline" disabled={busy} onClick={() => setImage(null)}>
                앨범 이미지 삭제
              </button>
            </div>
          </div>
        ) : (
        <label>
          {kind === "source" ? "앨범" : "사진"}
          <span className={sharedStyles.socialImagePicker}>
            {image ? (
              <img src={image.url} alt="첨부 이미지 미리보기" width={350} height={280} />
            ) : (
              <span>
                <strong>{kind === "source" ? "앨범 추가" : "사진 추가"}</strong>
                <small>JPG, PNG, WEBP 최대 100MB</small>
              </span>
            )}
            <input
              aria-label={kind === "source" ? "앨범 추가" : "사진 추가"}
              disabled={busy}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => pickImage(event.target)}
            />
          </span>
          {image && (
            <button
              type="button"
              className={sharedStyles.creationRemoveImage}
              disabled={busy}
              onClick={() => setImage(null)}
            >
              첨부 사진 삭제
            </button>
          )}
        </label>
        )}
      </div>
      {kind === "source" && (
        <fieldset className="m-0 flex w-full max-w-[350px] min-w-0 shrink-0 flex-wrap gap-4 border-0 p-0 text-body [&_input]:h-4 [&_input]:w-4 [&_input]:shrink-0" disabled={busy}>
          <legend className="mb-2">등록 공개 설정</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="source-visibility" value="PUBLIC" checked={sourceVisibility === "PUBLIC"} onChange={() => setSourceVisibility("PUBLIC")} />
            공개 등록
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="source-visibility" value="PRIVATE" checked={sourceVisibility === "PRIVATE"} onChange={() => setSourceVisibility("PRIVATE")} />
            비공개 등록
          </label>
          <p className="w-full text-caption text-app-muted">비공개 등록은 내 등록에서만 관리하며, 나중에 공개할 수 있습니다.</p>
        </fieldset>
      )}
      <p className={sharedStyles.creationSaveStatus} role="status">
        {draftSaving
          ? "초안을 저장하는 중..."
          : storageError
            ? "초안을 저장하지 못했습니다."
            : "이 브라우저에 초안이 임시 저장됩니다."}
      </p>
      {kind === "post" && postTargetStatus !== "ready" && (
        <p
          className={communityStyles.postTargetNotice}
          role={postTargetStatus === "loading" ? "status" : "alert"}
        >
          {postTargetStatus === "loading"
            ? "게시할 커뮤니티를 확인하는 중입니다."
            : postTargetStatus === "error"
              ? "커뮤니티를 불러오지 못했습니다. 상단의 커뮤니티 선택에서 다시 시도해주세요."
              : "상단에서 게시할 커뮤니티를 선택해주세요."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {storageError && <p role="alert">{storageError}</p>}
      {imageRestoreFailed ? (
        <div>
          <p role="alert">앨범 이미지를 복원하지 못했습니다. 다시 첨부하거나 이미지 없이 등록을 선택해주세요.</p>
          <button
            type="button"
            className={sharedStyles.creationRemoveImage}
            onClick={() => {
              setImageRestoreFailed(false);
              setRestoreError("");
            }}
          >
            앨범 이미지 없이 등록
          </button>
        </div>
      ) : restoreError && <p role="alert">{restoreError}</p>}
      <button
        className={communityStyles.socialCreateSubmit}
        type="submit"
        disabled={
          busy ||
          imageRestoreFailed ||
          (kind === "post" && postTargetStatus !== "ready") ||
          !title.trim() ||
          (kind !== "source" && !content.trim()) ||
          (kind === "source" && !audio && !sourceAudioLocked)
        }
      >
        {busy ? "저장 중..." : kind === "community" ? "개설 신청" : kind === "source" ? `${sourceVisibility === "PUBLIC" ? "공개" : "비공개"} 등록` : "입력 완료"}
      </button>
      <button
        type="button"
        className={sharedStyles.creationDiscard}
        disabled={busy}
        onClick={() => setConfirmDiscard(true)}
      >
        작성 취소
      </button>
      {confirmDiscard && (
        <CanvasDialog
          className={sharedStyles.creationDiscardDialog}
          titleId="creation-discard-title"
          onClose={() => setConfirmDiscard(false)}
        >
          <h2 id="creation-discard-title">작성 중인 내용을 삭제할까요?</h2>
          <p>제목, 본문 및 첨부 파일이 삭제됩니다.</p>
          <div>
            <button
              type="button"
              className={buttonVariants({
                tone: "secondary",
              })}
              onClick={() => setConfirmDiscard(false)}
            >
              계속 작성
            </button>
            <button
              type="button"
              className={buttonVariants({
                tone: "primary",
              })}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const userId = getCurrentUserId();
                  if (kind === "source" && userId !== null) {
                    await withSourcePublicationLock({ userId, draftKey, draftRevision }, () => {
                      clearPendingPublication({ userId, draftKey });
                      clearCreationDraft(draftStorageKey);
                    });
                  } else {
                    clearCreationDraft(draftStorageKey);
                  }
                } catch (cause) {
                  setConfirmDiscard(false);
                  setError(sourceError(cause, "초안을 삭제하지 못했습니다. 다시 시도해주세요."));
                  return;
                } finally {
                  setBusy(false);
                }
                setDiscarding(true);
                onCancel();
              }}
            >
              삭제하고 나가기
            </button>
          </div>
        </CanvasDialog>
      )}
    </form>
  );
}

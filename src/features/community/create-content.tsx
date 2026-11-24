import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_NAME_MIN_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  SOURCE_DESCRIPTION_MAX_LENGTH,
  SOURCE_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  hasVisibleText,
  sanitizeMultiline,
  sanitizeSingleLine,
} from "@/lib/content-limits";
import type { PostTargetStatus } from "@/features/community/post-target";
import { SourcePianoEditor } from "@/features/composition/source-piano-editor";
import {
  InstrumentPromptCancelled,
  useInstrumentPrompt,
} from "@/features/composition/use-instrument-prompt";
import { partLabel, supportsMidi } from "@/features/composition/instrument-parts";
import type { MidiNoteDto } from "@/lib/api/composition";
import {
  CompositionChoiceScreen,
  CompositionUploadScreen,
  CompositionRecordScreen,
} from "../composition/creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { defaultSignature, type TimeSignature } from "@/features/composition/time-signature";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getCurrentUserId } from "@/lib/api/client";
import {
  readCreationDraft,
  restoreCreationDraft,
  rememberCreationDraft,
  clearCreationDraft,
} from "@/features/community/creation-draft";
import { CanvasDialog } from "@/components/canvas-dialog";
import { LoadingOverlay } from "@/components/loading-overlay";
import { NativeDialog } from "@/components/native-dialog";
import { nativeApp } from "@/lib/native-app";
import { createPost, proposeGallery } from "@/lib/api/community";
import { uploadMedia } from "@/lib/api/media";
import { validatePostImage } from "@/features/community/post-image";
import type { GalleryListItem } from "@/lib/api/contracts";
import {
  clearPendingPublication,
  getPendingSourceAudioId,
  getPendingSourceInstrument,
  getSourceDraftRevision,
  hasPendingPublication,
  publishSource,
  subscribeSourcePublication,
  withSourcePublicationLock,
} from "@/features/sources/publish-source";
import { sourceError } from "@/features/sources/source-screens";
import { ThumbnailCropper } from "@/features/sources/thumbnail-cropper";
import {
  defaultCrop,
  renderThumbnail,
  type ThumbnailCrop,
} from "@/features/sources/thumbnail-crop";
export type AudioStage = "details" | "choose" | "upload" | "record" | "note";

export type SocialCreateProps = {
  onCancel: () => void;
  postTargetStatus?: PostTargetStatus;
  audioStage?: AudioStage;
  onAudioStage?: (stage: AudioStage) => void;
  kind: "post" | "community" | "source";
  galleryId: number;
  onCreated: (gallery?: GalleryListItem) => void;
};

/**
 * State of the creation form (posts, community proposals, samples) with its locally saved draft.
 * One instance per page; the web form (`SocialCreateForm`) and the app's native screens read the same
 * state. The form also mounts the platform-specific discard confirmation (`setConfirmDiscard`).
 */
export type SocialCreateState = {
  kind: SocialCreateProps["kind"];
  postTargetStatus: PostTargetStatus;
  audioStage: AudioStage;
  setAudioStage: (stage: AudioStage) => void;
  /** "작성 중인 내용을 불러오는 중..." */
  restoring: boolean;
  /** The draft was published or discarded elsewhere ("다른 탭에서 이 초안을..."). */
  draftExpired: boolean;
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  /** The attached picture and its object URL. */
  image: { file: File; url: string } | null;
  /** Validates and attaches a picture; a rejected one sets `error`. */
  pickImage: (file: File) => void;
  removeImage: () => void;
  audio: File | null;
  sourceInstrument: string | null;
  /** The piano roll's instrument: chosen before entering it and changed from its toolbar picker. */
  pianoInstrument: string | null;
  setPianoInstrument: (id: string) => void;
  instrumentPrompt: ReturnType<typeof useInstrumentPrompt>;
  chooseAudioMethod: (method: "upload" | "record" | "note") => Promise<void>;
  /** A retried sample publication reuses the uploaded audio. */
  sourceAudioLocked: boolean;
  selectAudio: (file: File, selection?: AudioSelection) => Promise<void>;
  saveSelectedAudio: (file: File) => void;
  pianoNotes: MidiNoteDto[];
  setPianoNotes: Dispatch<SetStateAction<MidiNoteDto[]>>;
  pianoBpm: number;
  setPianoBpm: Dispatch<SetStateAction<number>>;
  sourceVisibility: "PRIVATE" | "PUBLIC";
  setSourceVisibility: (visibility: "PRIVATE" | "PUBLIC") => void;
  imageCrop: ThumbnailCrop;
  setImageCrop: (crop: ThumbnailCrop) => void;
  imageRestoreFailed: boolean;
  /** "앨범 이미지 없이 등록". */
  keepWithoutImage: () => void;
  busy: boolean;
  error: string | null;
  storageError: string;
  restoreError: string;
  /** The draft save line under the fields. */
  draftStatus: string;
  /** Why a post cannot be sent to the chosen community yet. */
  targetNotice: { text: string; tone: "status" | "alert" } | null;
  canSubmit: boolean;
  submitLabel: string;
  submit: () => Promise<void>;
  confirmDiscard: boolean;
  setConfirmDiscard: (open: boolean) => void;
  /** "삭제하고 나가기": clears the draft and leaves. */
  discard: () => Promise<void>;
};

export function SocialCreate(props: SocialCreateProps) {
  const form = useSocialCreate(props);
  return <SocialCreateForm form={form} />;
}

export function useSocialCreate({
  onCancel,
  postTargetStatus = "ready",
  kind,
  galleryId,
  onCreated,
  audioStage = "details",
  onAudioStage,
}: SocialCreateProps): SocialCreateState {
  const userId = getCurrentUserId();
  const [draftKey] = useState(() => `live:${userId ?? "guest"}:${kind}`);
  const readSourceRevision = () =>
    kind === "source" && userId !== null ? getSourceDraftRevision({ userId, draftKey }) : null;
  const [draftRevision] = useState(readSourceRevision);
  const draftStorageKey =
    draftRevision === null ? draftKey : JSON.stringify([draftKey, draftRevision]);
  const initial = readCreationDraft(draftStorageKey);
  const [restoring, setRestoring] = useState(true);
  const [discarding, setDiscarding] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const [storageError, setStorageError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const writes = useRef(0);
  const [pianoNotes, setPianoNotes] = useState<MidiNoteDto[]>(() => initial?.notes ?? []);
  const [pianoBpm, setPianoBpm] = useState(() => initial?.bpm ?? 120);
  const [pianoInstrument, setPianoInstrument] = useState<string | null>(
    () => initial?.pianoInstrument ?? null,
  );
  const [sourceInstrument, setSourceInstrument] = useState<string | null>(
    () => initial?.sourceInstrument ?? null,
  );
  const instrumentPrompt = useInstrumentPrompt(null, { standalone: true });
  const [title, setTitle] = useState(() => initial?.title ?? "");
  const [content, setContent] = useState(() => initial?.content ?? "");
  const [image, setImage] = useState<{ file: File; url: string } | null>(() =>
    initial?.image ? { file: initial.image, url: URL.createObjectURL(initial.image) } : null,
  );
  const [audio, setAudio] = useState<File | null>(() => initial?.audio ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceVisibility, setSourceVisibility] = useState<"PRIVATE" | "PUBLIC">(() =>
    initial?.sourceVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
  );
  const [imageCrop, setImageCrop] = useState<ThumbnailCrop>(
    () => initial?.imageCrop ?? defaultCrop(),
  );
  const [imageRestoreFailed, setImageRestoreFailed] = useState(false);
  const subscribeSourceDraft = useCallback(
    (onChange: () => void) => {
      if (kind === "source" && userId !== null) {
        return subscribeSourcePublication({ userId, draftKey }, onChange);
      }
      return () => {};
    },
    [kind, userId, draftKey],
  );
  const readSourceAudioId = () =>
    kind === "source" && userId !== null ? getPendingSourceAudioId({ userId, draftKey }) : null;
  const pendingAudioId = useSyncExternalStore(subscribeSourceDraft, readSourceAudioId, () => null);
  // An uploaded audio keeps the instrument it was uploaded with, even when another tab uploaded it.
  const pendingInstrument = useSyncExternalStore(
    subscribeSourceDraft,
    () =>
      kind === "source" && userId !== null ? getPendingSourceInstrument({ userId, draftKey }) : null,
    () => null,
  );
  const currentRevision = useSyncExternalStore(
    subscribeSourceDraft,
    readSourceRevision,
    () => null,
  );
  const draftExpired = draftRevision !== currentRevision;
  const sourceAudioLocked = pendingAudioId !== null;
  const draftValue = useMemo(
    () => ({
      title,
      content,
      image: image?.file ?? null,
      audio,
      notes: pianoNotes,
      bpm: pianoBpm,
      pianoInstrument,
      sourceInstrument,
      sourceVisibility,
      imageCrop,
      imageRestoreFailed,
    }),
    [
      title,
      content,
      image,
      audio,
      pianoNotes,
      pianoBpm,
      pianoInstrument,
      sourceInstrument,
      sourceVisibility,
      imageCrop,
      imageRestoreFailed,
    ],
  );
  const [savedDraft, setSavedDraft] = useState<typeof draftValue | null>(null);
  const draftSaving =
    !restoring && !discarding && !draftExpired && !storageError && savedDraft !== draftValue;
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
        setPianoInstrument(draft.pianoInstrument ?? null);
        setSourceInstrument(draft.sourceInstrument ?? null);
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
    if (
      kind === "source" &&
      userId !== null &&
      getSourceDraftRevision({ userId, draftKey }) !== draftRevision
    )
      return;
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
  }, [
    draftKey,
    draftStorageKey,
    draftValue,
    restoring,
    discarding,
    draftExpired,
    draftRevision,
    kind,
    userId,
  ]);
  useEffect(() => {
    if (!draftSaving) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [draftSaving]);
  const setAudioStage = (stage: AudioStage) => onAudioStage?.(stage);
  // A pre-upgrade piano-roll draft has no instrument; its `stage=note` link continues at the choice step.
  const leaveNoteWithoutInstrument = useEffectEvent(() => setAudioStage("choose"));
  useEffect(() => {
    if (!restoring && audioStage === "note" && !supportsMidi(pianoInstrument))
      leaveNoteWithoutInstrument();
  }, [restoring, audioStage, pianoInstrument]);
  // An instrument request belongs to the audio step that asked for it. Leaving that step (or the page)
  // closes the chooser and discards its answer, even while the audio is still being prepared.
  const audioStep = useRef<object>({});
  const cancelInstrument = instrumentPrompt.cancel;
  useEffect(() => {
    audioStep.current = {};
    return cancelInstrument;
  }, [audioStage, cancelInstrument]);
  async function chooseAudioMethod(method: "upload" | "record" | "note") {
    if (method !== "note") return setAudioStage(method);
    const step = audioStep.current;
    try {
      const id = await instrumentPrompt.ask({ mode: "midi" });
      if (audioStep.current !== step || readSourceAudioId() !== null) return;
      setPianoInstrument(id);
      setAudioStage("note");
    } catch (cause) {
      if (!(cause instanceof InstrumentPromptCancelled))
        setError(sourceError(cause, "악기를 선택하지 못했습니다."));
    }
  }
  function saveSelectedAudio(file: File) {
    if (readSourceAudioId() === null) {
      setAudio(file);
      setSourceInstrument(pianoInstrument);
    }
    setAudioStage("details");
  }
  async function selectAudio(file: File, selection?: AudioSelection) {
    const step = audioStep.current;
    setRestoreError("");
    const { wav } = await prepareAudioFile(file, selection);
    if (audioStep.current !== step) throw new InstrumentPromptCancelled();
    const prepared = new File([wav], "opensource.wav", { type: "audio/wav" });
    const id = await instrumentPrompt.ask({ mode: "audio", audio: { file: prepared } });
    if (audioStep.current !== step) throw new InstrumentPromptCancelled();
    if (readSourceAudioId() !== null) return;
    setAudio(prepared);
    setSourceInstrument(id);
    setPianoNotes([]);
    setAudioStage("details");
  }
  function pickImage(file: File) {
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
  async function submit() {
    const cleanTitle = sanitizeSingleLine(title);
    const cleanContent = sanitizeMultiline(content);
    if (
      busy ||
      draftExpired ||
      !cleanTitle ||
      !hasVisibleText(cleanTitle) ||
      imageRestoreFailed ||
      (kind !== "source" && (!cleanContent || !hasVisibleText(cleanContent))) ||
      (kind === "post" && postTargetStatus !== "ready")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "post") {
        if (
          codePointLength(cleanTitle) > POST_TITLE_MAX_LENGTH ||
          codePointLength(cleanContent) > POST_CONTENT_MAX_LENGTH
        )
          throw new Error(
            `제목은 ${POST_TITLE_MAX_LENGTH}자, 본문은 ${POST_CONTENT_MAX_LENGTH}자 이내로 입력해주세요.`,
          );
        const imageId = image ? await uploadMedia(image.file, "IMAGE") : null;
        await createPost(galleryId, cleanTitle, cleanContent, imageId);
        setDiscarding(true);
        clearCreationDraft(draftKey);
        onCreated();
      } else if (kind === "source") {
        const userId = getCurrentUserId();
        if (userId === null) throw new Error("로그인 후 샘플을 등록할 수 있습니다.");
        if (!audio && !sourceAudioLocked) throw new Error("오디오를 먼저 선택해주세요.");
        if (
          codePointLength(cleanTitle) > SOURCE_TITLE_MAX_LENGTH ||
          codePointLength(cleanContent) > SOURCE_DESCRIPTION_MAX_LENGTH
        )
          throw new Error(
            `샘플 이름은 ${SOURCE_TITLE_MAX_LENGTH}자, 설명은 ${SOURCE_DESCRIPTION_MAX_LENGTH}자 이내로 입력해주세요.`,
          );
        try {
          await withSourcePublicationLock({ userId, draftKey, draftRevision }, async () => {
            // The original stays in the draft; only the framed thumbnail is uploaded.
            const thumbnail = image ? await renderThumbnail(image.file, imageCrop) : null;
            await publishSource({
              instrument: sourceInstrument,
              ...(pianoNotes.length > 0
                ? {
                    midiPpq: 480,
                    midiBpm: pianoBpm,
                    midiNotes: pianoNotes.map(({ pitch, startTick, durationTick, velocity }) => ({
                      pitch,
                      startTick,
                      durationTick,
                      velocity,
                    })),
                  }
                : {}),
              userId,
              draftKey,
              title: cleanTitle,
              description: cleanContent || null,
              audio,
              expectedPendingAudioId: pendingAudioId,
              image: thumbnail,
              visibility: sourceVisibility,
            });
            setDiscarding(true);
            clearCreationDraft(draftStorageKey);
          });
        } catch (cause) {
          const message = sourceError(cause, "샘플을 등록하지 못했습니다.");
          throw new Error(
            hasPendingPublication({ userId, draftKey })
              ? `샘플 등록 기록이 있습니다. 다시 시도하면 같은 등록에서 선택한 공개 설정으로 이어서 저장합니다. (${message})`
              : message,
          );
        }
        onCreated();
      } else if (kind === "community") {
        if (getCurrentUserId() === null)
          throw new Error("로그인 후 커뮤니티 개설을 신청할 수 있습니다.");
        const trimmedName = cleanTitle;
        const trimmedDesc = cleanContent;
        if (
          codePointLength(trimmedName) < COMMUNITY_NAME_MIN_LENGTH ||
          codePointLength(trimmedName) > COMMUNITY_NAME_MAX_LENGTH
        )
          throw new Error(
            `커뮤니티 이름은 ${COMMUNITY_NAME_MIN_LENGTH}자 이상 ${COMMUNITY_NAME_MAX_LENGTH}자 이내로 입력해주세요.`,
          );
        if (codePointLength(trimmedDesc) > COMMUNITY_DESCRIPTION_MAX_LENGTH)
          throw new Error(
            `설명은 ${COMMUNITY_DESCRIPTION_MAX_LENGTH}자 이내로 입력해주세요.`,
          );
        await proposeGallery(trimmedName, trimmedDesc);
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
  async function discard() {
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
  }
  return {
    kind,
    postTargetStatus,
    audioStage,
    setAudioStage,
    restoring,
    draftExpired,
    title,
    setTitle,
    content,
    setContent,
    image,
    pickImage,
    removeImage: () => setImage(null),
    audio,
    sourceInstrument: sourceAudioLocked ? pendingInstrument : sourceInstrument,
    pianoInstrument,
    setPianoInstrument,
    instrumentPrompt,
    chooseAudioMethod,
    sourceAudioLocked,
    selectAudio,
    saveSelectedAudio,
    pianoNotes,
    setPianoNotes,
    pianoBpm,
    setPianoBpm,
    sourceVisibility,
    setSourceVisibility,
    imageCrop,
    setImageCrop,
    imageRestoreFailed,
    keepWithoutImage: () => {
      setImageRestoreFailed(false);
      setRestoreError("");
    },
    busy,
    error,
    storageError,
    restoreError,
    draftStatus: draftSaving
      ? "초안을 저장하는 중..."
      : storageError
        ? "초안을 저장하지 못했습니다."
        : "이 브라우저에 초안이 임시 저장됩니다.",
    targetNotice:
      kind === "post" && postTargetStatus !== "ready"
        ? {
            tone: postTargetStatus === "loading" ? "status" : "alert",
            text:
              postTargetStatus === "loading"
                ? "게시할 커뮤니티를 확인하는 중입니다."
                : postTargetStatus === "error"
                  ? "커뮤니티를 불러오지 못했습니다. 상단의 커뮤니티 선택에서 다시 시도해주세요."
                  : postTargetStatus === "not_joined"
                    ? "이 커뮤니티에 가입한 후 글을 작성할 수 있습니다. 상단에서 가입한 커뮤니티를 선택해주세요."
                    : "상단에서 게시할 커뮤니티를 선택해주세요.",
          }
        : null,
    canSubmit: !(
      busy ||
      imageRestoreFailed ||
      (kind === "post" && postTargetStatus !== "ready") ||
      !hasVisibleText(title) ||
      (kind !== "source" && !hasVisibleText(content)) ||
      (kind === "source" && !audio && !sourceAudioLocked)
    ),
    submitLabel: busy
      ? "저장 중..."
      : kind === "community"
        ? "개설 신청"
        : kind === "source"
          ? `${sourceVisibility === "PUBLIC" ? "공개" : "비공개"} 등록`
          : "입력 완료",
    submit,
    confirmDiscard,
    setConfirmDiscard,
    discard,
  };
}

/** The web creation form for the state of `useSocialCreate`. */
export function SocialCreateForm({ form }: { form: SocialCreateState }) {
  return (
    <>
      {form.instrumentPrompt.dialog}
      <SocialCreateFormContent form={form} />
    </>
  );
}

function SocialCreateFormContent({ form }: { form: SocialCreateState }) {
  const {
    kind,
    audioStage,
    setAudioStage,
    restoring,
    draftExpired,
    title,
    setTitle,
    content,
    setContent,
    image,
    audio,
    sourceAudioLocked,
    selectAudio,
    saveSelectedAudio,
    pianoNotes,
    setPianoNotes,
    pianoBpm,
    setPianoBpm,
    pianoInstrument,
    setPianoInstrument,
    sourceInstrument,
    sourceVisibility,
    setSourceVisibility,
    imageCrop,
    setImageCrop,
    imageRestoreFailed,
    busy,
    error,
    storageError,
    restoreError,
    targetNotice,
    confirmDiscard,
    setConfirmDiscard,
  } = form;
  const [sourceSignature, setSourceSignature] = useState<TimeSignature>(defaultSignature);
  function pickImage(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (file) form.pickImage(file);
  }
  if (nativeApp())
    return confirmDiscard ? (
      <NativeDialog
        model={{
          title: "작성 중인 내용을 삭제할까요?",
          message: "제목, 본문 및 첨부 파일이 삭제됩니다.",
          error: error ?? undefined,
          dismissible: !busy,
          actions: [
            { id: "continue", label: "계속 작성", disabled: busy },
            { id: "discard", label: "삭제하고 나가기", destructive: true, disabled: busy },
          ],
        }}
        onAction={(id) => {
          if (id === "continue") setConfirmDiscard(false);
          if (id === "discard" && !busy) void form.discard();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    ) : null;
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
        {audioStage === "choose" || (audioStage === "note" && !supportsMidi(pianoInstrument)) ? (
          <CompositionChoiceScreen
            busy={false}
            error={null}
            onBack={() => setAudioStage("details")}
            onChoose={(method) => void form.chooseAudioMethod(method)}
          />
        ) : audioStage === "upload" ? (
          <CompositionUploadScreen
            bpm={pianoBpm}
            signature={sourceSignature}
            timingMode="initial"
            onTiming={async ({ bpm, signature }) => {
              setPianoBpm(bpm);
              setSourceSignature(signature);
            }}
            saveLabel="오디오 선택 완료"
            onBack={() => setAudioStage("choose")}
            onSave={selectAudio}
            suppressLoadingOverlay={form.instrumentPrompt.open}
          />
        ) : audioStage === "note" ? (
          <SourcePianoEditor
            instrument={pianoInstrument!}
            onInstrument={setPianoInstrument}
            notes={pianoNotes}
            setNotes={setPianoNotes}
            bpm={pianoBpm}
            onBpm={setPianoBpm}
            onBack={() => setAudioStage("choose")}
            onSave={saveSelectedAudio}
          />
        ) : (
          <CompositionRecordScreen
            bpm={pianoBpm}
            signature={sourceSignature}
            timingMode="initial"
            onTiming={async ({ bpm, signature }) => {
              setPianoBpm(bpm);
              setSourceSignature(signature);
            }}
            saveLabel="녹음 선택 완료"
            onBack={() => setAudioStage("choose")}
            onSave={selectAudio}
            suppressLoadingOverlay={form.instrumentPrompt.open}
          />
        )}
      </div>
    );
  const titleLimit =
    kind === "post"
      ? POST_TITLE_MAX_LENGTH
      : kind === "community"
        ? COMMUNITY_NAME_MAX_LENGTH
        : SOURCE_TITLE_MAX_LENGTH;
  const contentLimit =
    kind === "post"
      ? POST_CONTENT_MAX_LENGTH
      : kind === "community"
        ? COMMUNITY_DESCRIPTION_MAX_LENGTH
        : SOURCE_DESCRIPTION_MAX_LENGTH;
  return (
    <form
      className={cn(communityStyles.socialCreateView, sharedStyles.scrollContent)}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
      aria-label={
        kind === "post" ? "게시글 작성" : kind === "community" ? "커뮤니티 생성" : "샘플 생성"
      }
    >
      <div className={communityStyles.socialCreateFields}>
        <label>
          {kind === "post" ? "제목" : kind === "community" ? "커뮤니티 이름" : "샘플 이름"}
          <input
            aria-label={
              kind === "post" ? "게시글 제목" : kind === "community" ? "커뮤니티 이름" : "샘플 이름"
            }
            disabled={busy}
            value={title}
            onChange={(event) => setTitle(clampCodePoints(event.target.value, titleLimit))}
            required
          />
          <small className="text-right text-caption text-app-muted tabular-nums">
            {codePointLength(title)}/{titleLimit}자
          </small>
        </label>
        <label>
          {kind === "post" ? "본문" : "설명"}
          <textarea
            aria-label={kind === "post" ? "게시글 내용" : "설명"}
            disabled={busy}
            value={content}
            onChange={(event) => setContent(clampCodePoints(event.target.value, contentLimit))}
            required={kind !== "source"}
            rows={1}
          />
          <small className="text-right text-caption text-app-muted tabular-nums">
            {codePointLength(content)}/{contentLimit}자
          </small>
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
              {sourceAudioLocked
                ? "업로드한 오디오 사용"
                : audio
                  ? "오디오 선택됨 · 다시 선택"
                  : "오디오 추가"}
            </button>
            {sourceInstrument && (
              <span className={sharedStyles.creationSaveStatus}>
                악기: {partLabel(sourceInstrument)}
              </span>
            )}
            {sourceAudioLocked && (
              <span className={sharedStyles.creationSaveStatus}>
                등록 재시도에는 이미 업로드한 오디오를 사용합니다. 다른 오디오를 등록하려면 작성
                취소 후 새로 작성해주세요.
              </span>
            )}
          </label>
        )}
        {kind === "community" ? (
          <p className={sharedStyles.creationSaveStatus}>
            커뮤니티 프로필 사진은 현재 서버에서 지원하지 않습니다. 이름과 설명으로 개설을 신청하면
            운영자 어드민 승인 후 커뮤니티가 만들어집니다.
          </p>
        ) : kind === "source" && image ? (
          // Not inside a <label>: a click or drag in the editor must not reopen the file picker.
          <div className="flex flex-col gap-[10px] text-title leading-[26px] font-bold text-app-fg">
            앨범
            <ThumbnailCropper
              file={image.file}
              crop={imageCrop}
              onChange={setImageCrop}
              disabled={busy}
            />
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
              <button
                type="button"
                className="underline"
                disabled={busy}
                onClick={form.removeImage}
              >
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
                onClick={form.removeImage}
              >
                첨부 사진 삭제
              </button>
            )}
          </label>
        )}
      </div>
      {kind === "source" && (
        <fieldset
          className="m-0 flex w-full max-w-[350px] min-w-0 shrink-0 flex-wrap gap-4 border-0 p-0 text-body [&_input]:h-4 [&_input]:w-4 [&_input]:shrink-0"
          disabled={busy}
        >
          <legend className="mb-2 text-title leading-[26px] font-bold text-app-fg">
            등록 공개 설정
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source-visibility"
              value="PUBLIC"
              checked={sourceVisibility === "PUBLIC"}
              onChange={() => setSourceVisibility("PUBLIC")}
            />
            공개 등록
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source-visibility"
              value="PRIVATE"
              checked={sourceVisibility === "PRIVATE"}
              onChange={() => setSourceVisibility("PRIVATE")}
            />
            비공개 등록
          </label>
          <p className="w-full text-caption text-app-muted">
            비공개 등록은 내 등록에서만 관리하며, 나중에 공개할 수 있습니다.
          </p>
        </fieldset>
      )}
      <p className={sharedStyles.creationSaveStatus} role="status">
        {form.draftStatus}
      </p>
      {targetNotice && (
        <p className={communityStyles.postTargetNotice} role={targetNotice.tone}>
          {targetNotice.text}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {storageError && <p role="alert">{storageError}</p>}
      {imageRestoreFailed ? (
        <div>
          <p role="alert">
            앨범 이미지를 복원하지 못했습니다. 다시 첨부하거나 이미지 없이 등록을 선택해주세요.
          </p>
          <button
            type="button"
            className={sharedStyles.creationRemoveImage}
            onClick={form.keepWithoutImage}
          >
            앨범 이미지 없이 등록
          </button>
        </div>
      ) : (
        restoreError && <p role="alert">{restoreError}</p>
      )}
      <button
        className={communityStyles.socialCreateSubmit}
        type="submit"
        disabled={!form.canSubmit}
      >
        {form.submitLabel}
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
              onClick={() => void form.discard()}
            >
              삭제하고 나가기
            </button>
          </div>
        </CanvasDialog>
      )}
      {kind === "source" && busy && <LoadingOverlay message="샘플을 등록하는 중입니다." />}
    </form>
  );
}

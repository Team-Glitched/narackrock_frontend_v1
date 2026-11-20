import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createDraftProject, updateProjectMetadata, uploadMedia } from "@/lib/api/composition";
import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { useImageCrop } from "@/features/images/use-image-crop";
import {
  errorText,
  getResumableProject,
  setStoredDraftId,
  storedDraftId,
  subscribeToDraft,
} from "./studio-helpers";
import {
  chooseProjectTitle,
  projectTitleHistoryKey,
  readRecentProjectTitles,
  rememberProjectTitle,
  withRecentProjectTitle,
} from "./project-title";

export type NewProjectOptions = {
  userId: number | null;
  onCreated: (id: number) => void;
  onResume: (id: number) => void;
};

/**
 * The new song form's state: suggested title (recent titles avoided), album image, creating the
 * draft project and resuming the stored one. Shared by the web form and the app's native screen.
 */
export function useNewProject({ userId, onCreated, onResume }: NewProjectOptions) {
  const savedDraftId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const historyKey = projectTitleHistoryKey(apiOrigin(), userId);
  const shownTitles = useRef<string[]>([]);
  const [suggestion, setSuggestion] = useState(() =>
    chooseProjectTitle(readRecentProjectTitles(historyKey)),
  );
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [title, setTitle] = useState(suggestion);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    shownTitles.current = withRecentProjectTitle(shownTitles.current, suggestion);
    rememberProjectTitle(historyKey, suggestion);
  }, [historyKey, suggestion]);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  async function start(chosenTitle: string) {
    if (busy || !chosenTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const userId = getCurrentUserId();
      if (userId === null) throw new Error("로그인이 필요합니다.");
      const scope = { origin: apiOrigin(), userId };
      const { projectId } = await createDraftProject();
      setStoredDraftId(projectId, scope);
      const imageId = image ? await uploadMedia(image, "IMAGE") : null;
      await updateProjectMetadata(projectId, chosenTitle.trim(), imageId);
      onCreated(projectId);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return {
    savedDraftId,
    suggestion,
    suggestionCount,
    title,
    setTitle,
    image,
    imageUrl,
    busy,
    error,
    suggestAnotherTitle() {
      const next = chooseProjectTitle([
        suggestion,
        ...shownTitles.current,
        ...readRecentProjectTitles(historyKey),
      ]);
      setSuggestion(next);
      setSuggestionCount((count) => count + 1);
      setTitle(next);
    },
    chooseImage(file: File) {
      if (file.size > 100 * 1024 * 1024) {
        setError("100MB 이하의 이미지를 선택해 주세요.");
        return;
      }
      setImage(file);
      setImageUrl(URL.createObjectURL(file));
      setError(null);
    },
    start,
    async resume() {
      if (!savedDraftId) return;
      try {
        const userId = getCurrentUserId();
        if (userId === null) throw new Error("로그인이 필요합니다.");
        setBusy(true);
        setError(null);
        await getResumableProject(savedDraftId, { origin: apiOrigin(), userId });
        onResume(savedDraftId);
      } catch (cause) {
        setError(errorText(cause));
      } finally {
        setBusy(false);
      }
    },
  };
}

export type NewProjectState = ReturnType<typeof useNewProject>;

export function NewProject({ project }: { project: NewProjectState }) {
  const titleId = useId();
  const selectOnFocus = useRef(true);
  const selectOnClick = useRef(false);
  const { busy, error, imageUrl, title } = project;
  const crop = useImageCrop({ file: project.image, onApply: project.chooseImage });
  return (
    <form
      className={sharedStyles.projectCreate}
      onSubmit={(event) => {
        event.preventDefault();
        void project.start(title);
      }}
    >
      <div className={sharedStyles.projectTitleField}>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={titleId}>음악명</label>
          <button
            type="button"
            className="min-h-9 rounded-lg px-2.5 text-body font-medium text-app-muted hover:bg-app-surface hover:text-app-fg"
            disabled={busy}
            onClick={() => {
              selectOnFocus.current = true;
              selectOnClick.current = false;
              project.suggestAnotherTitle();
            }}
          >
            다른 제목
          </button>
        </div>
        <input
          id={titleId}
          className="w-full"
          value={title}
          onPointerDown={() => {
            selectOnClick.current = selectOnFocus.current;
          }}
          onPointerCancel={() => {
            selectOnClick.current = false;
          }}
          onFocus={(event) => {
            if (!selectOnFocus.current) return;
            event.currentTarget.select();
            selectOnFocus.current = false;
          }}
          onClick={(event) => {
            // A pointer tap can place the caret after the focus handler runs.
            if (!selectOnClick.current) return;
            event.currentTarget.select();
            selectOnClick.current = false;
          }}
          onChange={(event) => project.setTitle(event.target.value)}
          maxLength={100}
          required
        />
      </div>
      <label className={"project-artwork-field"}>
        앨범
        <span className={`${sharedStyles.projectArtworkPicker} aspect-square !h-auto`}>
          {imageUrl ? (
            <img src={imageUrl} alt="선택한 앨범" width={350} height={350} />
          ) : (
            <>
              <strong>앨범 추가</strong>
              <small>JPG, PNG, WEBP 최대 100MB</small>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="앨범 추가"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) crop.select(file);
            }}
          />
        </span>
      </label>
      {crop.canEdit && (
        <button
          type="button"
          disabled={busy}
          className="self-center text-body text-app-muted underline"
          onClick={crop.edit}
        >
          크기·위치 조절
        </button>
      )}
      {crop.error && <p className={sharedStyles.projectError} role="alert">{crop.error}</p>}
      {crop.dialog}
      {error && (
        <p className={sharedStyles.projectError} role="alert">
          {error}
        </p>
      )}
      <div className={sharedStyles.projectCreateActions}>
        <button
          className={buttonVariants({
            tone: "primary",
          })}
          type="submit"
          disabled={busy || !title.trim()}
        >
          {busy ? "만드는 중…" : "입력 완료"}
        </button>
        {project.savedDraftId && (
          <button
            className={sharedStyles.resumeDraft}
            type="button"
            disabled={busy}
            onClick={() => void project.resume()}
          >
            이전 작업 이어하기
          </button>
        )}
      </div>
    </form>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateProjectMetadata, uploadMedia } from "@/lib/api/composition";
import { queryScope } from "@/lib/query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { buttonVariants } from "@/styles/variants";
import { errorText } from "./studio-helpers";
import { ImageCropInput } from "@/features/images/image-crop-input";
import {
  SONG_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  hasVisibleText,
  sanitizeSingleLine,
} from "@/lib/content-limits";

/**
 * Saves the song's title and optional new cover: the submit of ProjectMetadataEditor, also used by the app's
 * abyss editor. `save` ignores blank titles and reports an over-long one.
 */
export function useProjectMetadataSave(
  projectId: number,
  { onSaved, onBusyChange }: { onSaved: () => void; onBusyChange?: (busy: boolean) => void },
) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(title: string, image: File | null) {
    const trimmed = sanitizeSingleLine(title);
    if (busy || !trimmed || !hasVisibleText(trimmed)) return;
    if (codePointLength(trimmed) > SONG_TITLE_MAX_LENGTH) {
      setError(`곡 제목은 ${SONG_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const imageId = image ? await uploadMedia(image, "IMAGE") : null;
      await updateProjectMetadata(projectId, trimmed, imageId);
      // Detail, feed, profile and song lists all carry copies of the title and cover.
      void queryClient.invalidateQueries({
        queryKey: queryScope(userId),
        predicate: (query) =>
          ["shorts", "songs", "profiles"].includes(String(query.queryKey[2])) ||
          (query.queryKey[2] === "composition" && query.queryKey[4] === "tracks"),
      });
      onSaved();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return { busy, error, save };
}

/** Edits only the song's title/cover; saving never publishes audio or commits personal notes. */
export function ProjectMetadataEditor({
  projectId,
  title: originalTitle,
  albumImageUrl,
  onClose,
  onBusyChange,
}: {
  projectId: number;
  title: string;
  albumImageUrl?: string | null;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(originalTitle);
  const [image, setImage] = useState<File | null>(null);
  const { busy, error, save } = useProjectMetadataSave(projectId, { onSaved: onClose, onBusyChange });

  return (
    <form
      className="flex w-full max-w-96 flex-col gap-4 p-4 text-body text-app-fg"
      onSubmit={(event) => {
        event.preventDefault();
        void save(title, image);
      }}
    >
      <h2 id="project-metadata-title" className="m-0 text-title">
        곡 정보 수정
      </h2>
      <label className="flex flex-col gap-2">
        곡 제목
        <input
          autoFocus
          className="w-full rounded border border-app-panel bg-app-surface p-2"
          value={title}
          required
          disabled={busy}
          onChange={(event) => setTitle(clampCodePoints(event.target.value, SONG_TITLE_MAX_LENGTH))}
        />
        <small className="text-right text-caption text-app-muted tabular-nums">
          {codePointLength(title)}/{SONG_TITLE_MAX_LENGTH}자
        </small>
      </label>
      {!image && albumImageUrl && (
        <img
          className="h-28 w-28 self-center rounded-lg object-cover"
          src={albumImageUrl}
          alt="앨범 이미지 미리보기"
        />
      )}
      <ImageCropInput file={image} disabled={busy} onChange={setImage} />
      <p className="m-0 text-caption text-app-muted">
        새 이미지를 선택하지 않으면 현재 표지를 유지합니다.
      </p>
      {error && (
        <p role="alert" className="m-0 text-caption">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={buttonVariants({ tone: "secondary", size: "compact" })}
          disabled={busy}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="submit"
          className={buttonVariants({ size: "compact" })}
          disabled={busy || !hasVisibleText(title)}
        >
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

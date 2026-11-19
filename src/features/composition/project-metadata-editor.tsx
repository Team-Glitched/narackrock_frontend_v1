import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateProjectMetadata, uploadMedia } from "@/lib/api/composition";
import { queryScope } from "@/lib/query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { buttonVariants } from "@/styles/variants";
import { errorText } from "./studio-helpers";

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
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(originalTitle);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  return (
    <form
      className="flex w-full max-w-96 flex-col gap-4 p-4 text-body text-app-fg"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !title.trim()) return;
        setBusy(true);
        onBusyChange?.(true);
        setError(null);
        try {
          const imageId = image ? await uploadMedia(image.file, "IMAGE") : null;
          await updateProjectMetadata(projectId, title.trim(), imageId);
          // Detail, feed, profile and song lists all carry copies of the title and cover.
          void queryClient.invalidateQueries({
            queryKey: queryScope(userId),
            predicate: (query) =>
              ["shorts", "songs", "profiles"].includes(String(query.queryKey[2])) ||
              (query.queryKey[2] === "composition" && query.queryKey[4] === "tracks"),
          });
          onClose();
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setBusy(false);
          onBusyChange?.(false);
        }
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
          maxLength={100}
          required
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      {(image || albumImageUrl) && (
        <img
          className="h-28 w-28 self-center rounded-lg object-cover"
          src={image?.url ?? albumImageUrl ?? undefined}
          alt="앨범 이미지 미리보기"
        />
      )}
      <label className="flex flex-col gap-2">
        앨범 이미지
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setImage(file ? { file, url: URL.createObjectURL(file) } : null);
          }}
        />
      </label>
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
          disabled={busy || !title.trim()}
        >
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

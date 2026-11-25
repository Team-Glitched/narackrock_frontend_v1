import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { uploadMedia } from "@/lib/api/media";
import { updateGalleryImages } from "@/lib/api/community";
import { galleryKeys } from "./community-queries";
import { adminKeys } from "@/features/admin/admin-queries";
import { buttonVariants } from "@/styles/variants";
import { FilePicker } from "@/components/file-picker";
import type { Community } from "./community-card";

type ImageEdit = { file: File; url: string } | null | undefined;
export type CommunityImageKey = "icon" | "banner";

export const communityImageLabels: Record<CommunityImageKey, string> = {
  icon: "커뮤니티 아이콘",
  banner: "커뮤니티 배너",
};

/**
 * The icon and banner edits of a community and their save. Undefined preserves the server image;
 * null explicitly removes it. The app's management screen uses the same state.
 */
export function useCommunityImagesEditor(community: Community) {
  const userId = useCurrentUserId();
  const client = useQueryClient();
  const [icon, setIcon] = useState<ImageEdit>();
  const [banner, setBanner] = useState<ImageEdit>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const uploaded = useRef(new WeakMap<File, number>());
  useEffect(
    () => () => {
      if (icon) URL.revokeObjectURL(icon.url);
    },
    [icon],
  );
  useEffect(
    () => () => {
      if (banner) URL.revokeObjectURL(banner.url);
    },
    [banner],
  );
  const edits = { icon, banner };
  const setters = { icon: setIcon, banner: setBanner };
  const current = { icon: community.imageUrl, banner: community.bannerImageUrl };
  async function mediaId(edit: ImageEdit, currentId?: number | null) {
    if (edit === undefined) return currentId ?? null;
    if (edit === null) return null;
    const existing = uploaded.current.get(edit.file);
    if (existing) return existing;
    const id = await uploadMedia(edit.file, "IMAGE");
    uploaded.current.set(edit.file, id);
    return id;
  }
  const canSave = !busy && (icon !== undefined || banner !== undefined);
  return {
    busy,
    error,
    saved,
    canSave,
    /** The picked file of an image, if any (the app draws its own preview from it). */
    file: (key: CommunityImageKey) => edits[key]?.file ?? null,
    /** What the image shows now: the picked file, the server image, or nothing. */
    preview: (key: CommunityImageKey) =>
      edits[key] === undefined ? (current[key] ?? null) : (edits[key]?.url ?? null),
    select(key: CommunityImageKey, file: File) {
      setters[key]({ file, url: URL.createObjectURL(file) });
      setSaved(false);
      setError(null);
    },
    remove(key: CommunityImageKey) {
      setters[key](null);
      setSaved(false);
      setError(null);
    },
    /** Shows a failure (the app's photo picker) the way a failed save is shown. */
    fail(message: string) {
      setSaved(false);
      setError(message);
    },
    async save() {
      if (!canSave) return;
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        const imageFileId = await mediaId(icon, community.imageFileId);
        const bannerImageFileId = await mediaId(banner, community.bannerImageFileId);
        await updateGalleryImages(community.galleryId, imageFileId, bannerImageFileId);
        await Promise.all([
          client.invalidateQueries({ queryKey: galleryKeys.all(userId) }),
          client.invalidateQueries({ queryKey: adminKeys.manageableGalleries(userId) }),
          client.invalidateQueries({ queryKey: adminKeys.gallery(userId, community.galleryId) }),
        ]);
        setIcon(undefined);
        setBanner(undefined);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "커뮤니티 이미지를 저장하지 못했습니다.");
      } finally {
        setBusy(false);
      }
    },
  };
}

export function CommunityImagesEditor({ community }: { community: Community }) {
  const editor = useCommunityImagesEditor(community);
  const { busy } = editor;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      {(["icon", "banner"] as const).map((key) => {
        const label = communityImageLabels[key];
        const preview = editor.preview(key);
        return (
          <fieldset
            key={key}
            disabled={busy}
            className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
          >
            <legend className="mb-2 text-body font-semibold">{label}</legend>
            {preview ? (
              <img
                src={preview}
                alt={`${label} 미리보기`}
                className={
                  key === "icon"
                    ? "size-20 rounded-full object-cover"
                    : "aspect-[3/1] w-full rounded-xl object-cover"
                }
              />
            ) : (
              <p className="m-0 text-caption text-app-muted">등록된 이미지가 없습니다.</p>
            )}
            <FilePicker
              accept="image/png,image/jpeg,image/webp,image/gif"
              label={`${label} 파일 선택`}
              disabled={busy}
              onSelect={(file) => editor.select(key, file)}
            />
            {preview && (
              <button
                type="button"
                className="self-start text-caption text-app-muted"
                onClick={() => editor.remove(key)}
              >
                {label} 제거
              </button>
            )}
          </fieldset>
        );
      })}
      {editor.error && (
        <p role="alert" className="m-0 text-caption">
          {editor.error}
        </p>
      )}
      {editor.saved && (
        <p role="status" className="m-0 text-caption text-app-muted">
          커뮤니티 이미지를 저장했습니다.
        </p>
      )}
      <button className={buttonVariants({ tone: "primary" })} disabled={!editor.canSave}>
        {busy ? "이미지 저장 중..." : "이미지 저장"}
      </button>
    </form>
  );
}

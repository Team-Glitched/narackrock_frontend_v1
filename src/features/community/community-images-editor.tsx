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

/** Undefined preserves the server image; null explicitly removes it. */
export function CommunityImagesEditor({ community }: { community: Community }) {
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
  const preview = (edit: ImageEdit, current?: string | null) =>
    edit === undefined ? current : edit?.url;
  async function mediaId(edit: ImageEdit, current?: number | null) {
    if (edit === undefined) return current ?? null;
    if (edit === null) return null;
    const existing = uploaded.current.get(edit.file);
    if (existing) return existing;
    const id = await uploadMedia(edit.file, "IMAGE");
    uploaded.current.set(edit.file, id);
    return id;
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || (icon === undefined && banner === undefined)) return;
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
          setError(
            cause instanceof Error ? cause.message : "커뮤니티 이미지를 저장하지 못했습니다.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {(
        [
          {
            key: "icon",
            label: "커뮤니티 아이콘",
            edit: icon,
            set: setIcon,
            current: community.imageUrl,
          },
          {
            key: "banner",
            label: "커뮤니티 배너",
            edit: banner,
            set: setBanner,
            current: community.bannerImageUrl,
          },
        ] as const
      ).map((item) => (
        <fieldset
          key={item.key}
          disabled={busy}
          className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
        >
          <legend className="mb-2 text-body font-semibold">{item.label}</legend>
          {preview(item.edit, item.current) ? (
            <img
              src={preview(item.edit, item.current) ?? undefined}
              alt={`${item.label} 미리보기`}
              className={
                item.key === "icon"
                  ? "size-20 rounded-full object-cover"
                  : "aspect-[3/1] w-full rounded-xl object-cover"
              }
            />
          ) : (
            <p className="m-0 text-caption text-app-muted">등록된 이미지가 없습니다.</p>
          )}
          <FilePicker
            accept="image/png,image/jpeg,image/webp,image/gif"
            label={`${item.label} 파일 선택`}
            disabled={busy}
            onSelect={(file) => {
              item.set({ file, url: URL.createObjectURL(file) });
              setSaved(false);
              setError(null);
            }}
          />
          {preview(item.edit, item.current) && (
            <button
              type="button"
              className="self-start text-caption text-app-muted"
              onClick={() => {
                item.set(null);
                setSaved(false);
                setError(null);
              }}
            >
              {item.label} 제거
            </button>
          )}
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="m-0 text-caption">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="m-0 text-caption text-app-muted">
          커뮤니티 이미지를 저장했습니다.
        </p>
      )}
      <button
        className={buttonVariants({ tone: "primary" })}
        disabled={busy || (icon === undefined && banner === undefined)}
      >
        {busy ? "이미지 저장 중..." : "이미지 저장"}
      </button>
    </form>
  );
}

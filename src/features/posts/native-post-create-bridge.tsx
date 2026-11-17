import { useEffect, useState } from "react";
import type { SocialCreateState } from "@/features/community/create-content";
import type { GalleriesState } from "@/features/community/use-galleries";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeImage } from "@/lib/native-app";
import type { NativePostCreate } from "@/lib/native-screens";

/** Longest side of the attached picture's preview sent to the app (the bridge carries JSON). */
const PREVIEW_SIZE = 700;

/** A small JPEG data URL of `file` for the app's preview; null when the browser cannot decode it. */
async function previewOf(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PREVIEW_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/** In the app the create post page (SocialCreate kind "post") is drawn natively (native/screens/post/post-create.tsx). */
export function NativePostCreateBridge({
  form,
  galleries,
  galleryId,
  onCommunity,
  onBack,
  onSearch,
}: {
  form: SocialCreateState;
  galleries: GalleriesState & { refetch: () => void };
  galleryId: number;
  onCommunity: (galleryId: number) => void;
  onBack: () => void;
  onSearch: () => void;
}) {
  const file = form.image?.file ?? null;
  const [preview, setPreview] = useState<{ file: File; url: string | null } | null>(null);
  useEffect(() => {
    if (!file) return;
    let active = true;
    void previewOf(file).then((url) => {
      if (active) setPreview({ file, url });
    });
    return () => {
      active = false;
    };
  }, [file]);
  // The photo picker's own failure (e.g. an unsupported format); cleared by the next pick.
  const [pickError, setPickError] = useState<string | null>(null);
  const items = galleries.status === "ready" ? galleries.galleries : [];
  const model: NativePostCreate = {
    restoring: form.restoring,
    blocked:
      form.draftExpired && !form.busy
        ? "다른 탭에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요."
        : null,
    title: form.title,
    content: form.content,
    image: file ? { preview: preview?.file === file ? preview.url : null } : null,
    busy: form.busy,
    error: pickError ?? form.error,
    storageError: form.storageError || null,
    restoreError: form.imageRestoreFailed
      ? "앨범 이미지를 복원하지 못했습니다. 다시 첨부하거나 이미지 없이 등록을 선택해주세요."
      : form.restoreError || null,
    keepWithoutImage: form.imageRestoreFailed,
    draftStatus: form.draftStatus,
    targetNotice: form.targetNotice,
    canSubmit: form.canSubmit,
    submitLabel: form.submitLabel,
    communities: {
      status: galleries.status,
      items: items.map((gallery) => ({
        galleryId: gallery.galleryId,
        name: gallery.name,
        description: gallery.description ?? "",
        imageUrl: gallery.imageUrl ?? null,
        memberLabel: `가입자 ${gallery.subscriberCount.toLocaleString("ko-KR")}명`,
      })),
      selectedId: galleryId,
      selectedName: items.find((gallery) => gallery.galleryId === galleryId)?.name ?? null,
    },
  };
  return useNativeScreen("post-create", model, {
    // The web Header with the community picker in place of the avatar; the app draws it itself.
    header: null,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "post-create-title":
          return form.setTitle(action.value);
        case "post-create-content":
          return form.setContent(action.value);
        case "post-create-image":
          setPickError(null);
          void pickNativeImage().then(
            (picked) => {
              if (picked) form.pickImage(picked);
            },
            (cause: unknown) =>
              setPickError(
                cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다.",
              ),
          );
          return;
        case "post-create-remove-image":
          return form.removeImage();
        case "post-create-keep-without-image":
          return form.keepWithoutImage();
        case "post-create-submit":
          return void form.submit();
        case "post-create-discard":
          return form.setConfirmDiscard(true);
        case "post-create-community":
          return onCommunity(action.galleryId);
        case "post-create-communities-retry":
          return galleries.refetch();
      }
    },
  });
}

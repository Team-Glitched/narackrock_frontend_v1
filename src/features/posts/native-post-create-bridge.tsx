import { useState } from "react";
import type { SocialCreateState } from "@/features/community/create-content";
import type { GalleriesState } from "@/features/community/use-galleries";
import { previewImage, usePickedPreview } from "@/features/images/image-preview";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeImage } from "@/lib/native-app";
import type { NativePostCreate } from "@/lib/native-screens";

/** Longest side of the attached picture's preview sent to the app (the bridge carries JSON). */
const PREVIEW_SIZE = 700;
/** Largest original sent as the preview when the WebView cannot decode it; the model is re-sent on every change. */
const ORIGINAL_PREVIEW_MAX_BYTES = 512 * 1024;

/**
 * A small JPEG data URL of `file` for the app's preview. When the WebView cannot decode it, the
 * original file (up to 512 KB) as a data URL, which the app's own image decoder shows; null when larger.
 */
async function previewOf(file: File): Promise<string | null> {
  try {
    return (await previewImage(file, PREVIEW_SIZE)).uri;
  } catch {
    if (file.size > ORIGINAL_PREVIEW_MAX_BYTES) return null;
    // Executor form: the app's iOS WebView before 17.4 has no Promise.withResolvers.
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
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
  const previewUrl = usePickedPreview(file, previewOf);
  // The photo picker's own failure (e.g. an unsupported format); cleared by the next pick.
  const [pickError, setPickError] = useState<string | null>(null);
  const items = galleries.status === "ready" ? galleries.galleries : [];
  const model: NativePostCreate = {
    restoring: form.restoring,
    blocked:
      form.draftExpired && !form.busy
        ? "다른 화면에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요."
        : null,
    title: form.title,
    content: form.content,
    image: file ? { preview: previewUrl } : null,
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

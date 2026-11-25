import { clampCrop } from "@/features/images/image-crop";
import { usePreview } from "@/features/images/image-preview";
import { useImageCropState } from "@/features/images/use-image-crop";
import type { NativeAlbumAction, NativeAlbumImage } from "@/lib/native-screens";

/**
 * The app's album image field over the web's `useImageCropState`: `select` validates a picked
 * original and opens the native editor, "적용" renders the framing like the web's dialog, and
 * "크기·위치 조절" reopens the original with the applied framing.
 */
export function useNativeAlbumCrop({
  file,
  onApply,
}: {
  file: File | null;
  onApply: (file: File) => void;
}): {
  model: NativeAlbumImage;
  select: (source: File) => void;
  act: (action: NativeAlbumAction) => void;
} {
  const state = useImageCropState({ file, onApply });
  const { editing } = state;
  const original = usePreview(editing?.file ?? null, 600);
  const shown = usePreview(file, 700);
  return {
    model: {
      url: shown?.status === "ready" ? shown.uri : null,
      canEdit: state.canEdit,
      error: !editing ? state.error : null,
      editor:
        editing && original
          ? {
              image: original,
              crop: editing.crop,
              gif: editing.file.type === "image/gif",
              busy: state.busy,
              error: state.error,
            }
          : null,
    },
    select: state.select,
    act(action) {
      switch (action.type) {
        case "album-edit":
          return state.edit();
        case "album-cancel":
          return state.cancel();
        case "album-apply":
          // Like the web's "적용": only once the original is decoded, within its bounds.
          if (editing && original?.status === "ready")
            void state.apply({
              file: editing.file,
              crop: clampCrop(action.crop, original.width, original.height),
            });
          return;
      }
    },
  };
}

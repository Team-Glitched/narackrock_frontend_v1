import { useEffect, useState } from "react";

/** A picture sent to the app: the app cannot load the page's blob: URLs. */
export type ImagePreview =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; uri: string; width: number; height: number };

/**
 * A downscaled JPEG data URL of `file` (at most `maxSide` px) with the original's pixel size;
 * uploads still use the original file. Rejects when the picture cannot be decoded or drawn.
 */
export async function previewImage(file: File, maxSide: number) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      status: "ready" as const,
      uri: canvas.toDataURL("image/jpeg", 0.8),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/** `previewImage` of the current file: null without a file, `loading` until decoded, `failed` when it cannot be. */
export function usePreview(file: File | null, maxSide: number): ImagePreview | null {
  const [preview, setPreview] = useState<{ file: File; image: ImagePreview } | null>(null);
  useEffect(() => {
    if (!file) return;
    let active = true;
    void previewImage(file, maxSide).then(
      (image) => {
        if (active) setPreview({ file, image });
      },
      () => {
        if (active) setPreview({ file, image: { status: "failed" } });
      },
    );
    return () => {
      active = false;
    };
  }, [file, maxSide]);
  if (!file) return null;
  return preview?.file === file ? preview.image : { status: "loading" };
}

/**
 * A `width`×`height` JPEG data URL of a picked photo, covering the canvas centered (the web's
 * `object-cover`); null when it cannot be decoded.
 */
export async function previewDataUrl(
  file: File,
  { width = 280, height = 280 }: { width?: number; height?: number } = {},
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas
      .getContext("2d")
      ?.drawImage(
        bitmap,
        (width - bitmap.width * scale) / 2,
        (height - bitmap.height * scale) / 2,
        bitmap.width * scale,
        bitmap.height * scale,
      );
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

/**
 * The app's preview of a picked photo: `render(file)` once per file, null while it is drawn or
 * without a file. `render` must be stable (a module-level function).
 */
export function usePickedPreview(
  file: File | null,
  render: (file: File) => Promise<string | null> = previewDataUrl,
): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string | null } | null>(null);
  useEffect(() => {
    if (!file) return;
    let current = true;
    void render(file).then((url) => {
      if (current) setPreview({ file, url });
    });
    return () => {
      current = false;
    };
  }, [file, render]);
  return file && preview?.file === file ? preview.url : null;
}

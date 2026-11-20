/**
 * A square crop of an image, shown in a circle for profiles/thumbnails or a square for album covers. `x`/`y` are the crop centre as a
 * fraction of the image width/height; `zoom` 1 is the largest square that fits (the shorter side, like object-cover).
 */
export type ThumbnailCrop = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const defaultCrop = (): ThumbnailCrop => ({ zoom: 1, x: 0.5, y: 0.5 });

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Keeps the cropped square entirely inside the image; tolerates malformed (e.g. restored) values. */
export function clampCrop(
  crop: Partial<ThumbnailCrop> | null | undefined,
  width: number,
  height: number,
): ThumbnailCrop {
  const zoom = clamp(finite(crop?.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const side = Math.min(width, height) / zoom;
  const halfX = side / 2 / width;
  const halfY = side / 2 / height;
  return {
    zoom,
    x: clamp(finite(crop?.x, 0.5), halfX, 1 - halfX),
    y: clamp(finite(crop?.y, 0.5), halfY, 1 - halfY),
  };
}

/** The source square in image pixels. */
export function cropSourceRect(crop: ThumbnailCrop, width: number, height: number) {
  const { zoom, x, y } = clampCrop(crop, width, height);
  const size = Math.min(width, height) / zoom;
  return { sx: x * width - size / 2, sy: y * height - size / 2, size };
}

/** Where to draw the whole image so the crop exactly fills a `viewport`-sized square. */
export function cropDisplay(crop: ThumbnailCrop, width: number, height: number, viewport: number) {
  const { sx, sy, size } = cropSourceRect(crop, width, height);
  const scale = viewport / size;
  return { left: -sx * scale, top: -sy * scale, width: width * scale, height: height * scale };
}

/** Dragging the image by (dx, dy) viewport pixels moves the crop the opposite way. */
export function panCrop(
  crop: ThumbnailCrop,
  dx: number,
  dy: number,
  width: number,
  height: number,
  viewport: number,
) {
  const size = Math.min(width, height) / clampCrop(crop, width, height).zoom;
  const imagePixelsPerViewportPixel = size / viewport;
  return clampCrop(
    {
      ...crop,
      x: crop.x - (dx * imagePixelsPerViewportPixel) / width,
      y: crop.y - (dy * imagePixelsPerViewportPixel) / height,
    },
    width,
    height,
  );
}

export type CropPoint = { x: number; y: number };

/** Keeps the image point under the fingers' starting centre under their moving centre. */
export function pinchCrop(
  crop: ThumbnailCrop,
  scale: number,
  from: CropPoint,
  to: CropPoint,
  width: number,
  height: number,
  viewport: number,
): ThumbnailCrop {
  const source = cropSourceRect(crop, width, height);
  const zoom = clamp(crop.zoom * finite(scale, 1), MIN_ZOOM, MAX_ZOOM);
  const side = Math.min(width, height) / zoom;
  return clampCrop(
    {
      zoom,
      x:
        (source.sx + (from.x / viewport) * source.size - (to.x / viewport) * side + side / 2) /
        width,
      y:
        (source.sy + (from.y / viewport) * source.size - (to.y / viewport) * side + side / 2) /
        height,
    },
    width,
    height,
  );
}

const outputSize = 1024;

/** Renders the crop to a square image file for upload; transparency is kept for PNG/GIF sources. */
export async function renderThumbnail(file: File, crop: ThumbnailCrop): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, size } = cropSourceRect(crop, bitmap.width, bitmap.height);
    const side = Math.max(1, Math.min(outputSize, Math.round(size)));
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 편집하지 못했습니다.");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, side, side);
    const wanted =
      file.type === "image/png" || file.type === "image/gif"
        ? "image/png"
        : file.type === "image/webp"
          ? "image/webp"
          : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, wanted, 0.92));
    if (!blob) throw new Error("이미지를 편집하지 못했습니다.");
    // Browsers that cannot encode the requested type fall back to PNG; name the file after what was produced.
    const extension =
      blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "") || "thumbnail"}-thumbnail.${extension}`,
      { type: blob.type },
    );
  } finally {
    bitmap.close();
  }
}

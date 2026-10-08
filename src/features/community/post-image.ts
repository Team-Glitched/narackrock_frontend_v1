const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 100 * 1024 * 1024;

export function validatePostImage(file: Pick<File, "type" | "size">): void {
  if (!supportedImageTypes.has(file.type.toLowerCase())) {
    throw new Error("JPG, PNG, WEBP, GIF 이미지만 첨부할 수 있습니다.");
  }
  if (file.size <= 0 || file.size > maxImageBytes) {
    throw new Error("이미지는 100MB 이하여야 합니다.");
  }
}

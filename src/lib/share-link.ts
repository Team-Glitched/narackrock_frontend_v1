/** Shares a canonical app link with the native share sheet, falling back to the clipboard. Returns a notice. */
export async function shareLink(title: string, url: string): Promise<string | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return null;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return null;
    }
  }
  await navigator.clipboard.writeText(url);
  return "링크를 복사했습니다.";
}

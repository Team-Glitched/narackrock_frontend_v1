export type ShareLinkResult =
  | { status: "shared" | "cancelled" | "copied" }
  | { status: "manual"; title: string; url: string };

/** Browser capabilities only; callers resolve and validate entity URLs first. */
export async function shareLink(title: string, url: string): Promise<ShareLinkResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return { status: "shared" };
    } catch (cause) {
      if (cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError") {
        return { status: "cancelled" };
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return { status: "copied" };
  } catch {
    return { status: "manual", title, url };
  }
}

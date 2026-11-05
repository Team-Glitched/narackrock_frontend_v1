import { useState } from "react";
import { getPostShareLink, reactToPost, togglePostBookmark, type PostReaction } from "@/lib/api/community";
import { canonicalShareLink } from "@/lib/api/content-link";
import { getCurrentUserId } from "@/lib/api/client";
import { postError } from "@/features/posts/post-utils";
import type { PostDetailResponse } from "@/lib/api/contracts";
import { useShareLink } from "@/hooks/use-share-link";

/**
 * Server-owned post reaction/bookmark/share state. Values come from the post detail and are replaced only by
 * server responses; a pending change blocks further clicks and a failure leaves the previous server state.
 */
export function usePostInteractions(postId: number, detail: PostDetailResponse | null) {
  const sharing = useShareLink();
  const [override, setOverride] = useState<{ postId: number; reaction?: PostReaction; bookmarked?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const own = override?.postId === postId ? override : null;
  const reaction: PostReaction | null = own?.reaction ?? (detail ? detail : null);
  const bookmarked = own?.bookmarked ?? detail?.isBookmarked ?? false;
  async function run(action: () => Promise<void>) {
    if (busy) return;
    if (getCurrentUserId() === null) {
      setNotice("로그인 후 이용할 수 있습니다.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setNotice(postError(cause));
    } finally {
      setBusy(false);
    }
  }
  return {
    shareDialog: sharing.dialog,
    reaction,
    bookmarked,
    busy,
    notice,
    vote: (kind: "like" | "dislike") =>
      run(async () => {
        const next = await reactToPost(postId, kind);
        setOverride((old) => ({ ...(old?.postId === postId ? old : {}), postId, reaction: next }));
      }),
    toggleBookmark: () =>
      run(async () => {
        const next = await togglePostBookmark(postId);
        setOverride((old) => ({ ...(old?.postId === postId ? old : {}), postId, bookmarked: next.isBookmarked }));
      }),
    share: (title: string) =>
      run(async () => {
        const { shareUrl } = await getPostShareLink(postId);
        setNotice(await sharing.share(title, canonicalShareLink("post", postId, shareUrl, window.location.origin)));
      }),
  };
}

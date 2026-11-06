import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getPostShareLink, reactToPost, togglePostBookmark } from "@/lib/api/community";
import { canonicalShareLink } from "@/lib/api/content-link";
import { queryScope } from "@/lib/query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { applyPostReaction, postKeys } from "@/features/posts/post-queries";
import { profileKeys } from "@/features/profile/profile-queries";
import { postError } from "@/features/posts/post-utils";
import type { PostDetailResponse } from "@/lib/api/contracts";
import { useShareLink } from "@/hooks/use-share-link";

/**
 * Server-owned post reaction/bookmark/share state. Values come from the cached post detail and are replaced only
 * by server responses; a pending change blocks further clicks and a failure leaves the previous server state.
 */
export function usePostInteractions(postId: number, detail: PostDetailResponse | null) {
  const sharing = useShareLink();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [sharingBusy, setSharingBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Responses are tagged with the account/post they belong to, so another account or post never shows them.
  const scope = `${userId}:${postId}`;

  const vote = useMutation({
    mutationFn: async (kind: "like" | "dislike") => ({ scope, reaction: await reactToPost(postId, kind) }),
    onSuccess: ({ reaction }) => {
      applyPostReaction(queryClient, userId, postId, reaction);
      void queryClient.invalidateQueries({ queryKey: profileKeys.likedPostIds(userId) });
    },
    onError: (cause) => setNotice(postError(cause)),
  });
  const bookmark = useMutation({
    mutationFn: async () => ({ scope, ...(await togglePostBookmark(postId)) }),
    onSuccess: ({ isBookmarked }) => {
      queryClient.setQueryData<PostDetailResponse>(postKeys.detail(userId, postId), (cached) =>
        cached && { ...cached, isBookmarked },
      );
      void queryClient.invalidateQueries({ queryKey: [...queryScope(userId), "saved"] });
    },
    onError: (cause) => setNotice(postError(cause)),
  });

  const busy = vote.isPending || bookmark.isPending || sharingBusy;
  // The cached detail already carries every applied response; the mutation result covers a detail that never loaded.
  const voted = vote.data?.scope === scope ? vote.data.reaction : null;
  const saved = bookmark.data?.scope === scope ? bookmark.data.isBookmarked : undefined;

  function start() {
    if (busy) return false;
    if (userId === null) {
      setNotice("로그인 후 이용할 수 있습니다.");
      return false;
    }
    setNotice(null);
    return true;
  }

  return {
    shareDialog: sharing.dialog,
    reaction: detail ?? voted,
    bookmarked: detail?.isBookmarked ?? saved,
    busy,
    notice,
    vote: (kind: "like" | "dislike") => {
      if (start()) vote.mutate(kind);
    },
    toggleBookmark: () => {
      if (start()) bookmark.mutate();
    },
    share: async (title: string) => {
      if (!start()) return;
      setSharingBusy(true);
      try {
        const { shareUrl } = await getPostShareLink(postId);
        setNotice(await sharing.share(title, canonicalShareLink("post", postId, shareUrl, window.location.origin)));
      } catch (cause) {
        setNotice(postError(cause));
      } finally {
        setSharingBusy(false);
      }
    },
  };
}

import { infiniteQueryOptions, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { queryScope } from "@/lib/query";
import type {
  CommentAdapter,
  CommentItem,
  CommentKind,
  CommentPage,
  CommentReaction,
} from "./comment-model";

export function openCommentHideChannel(userId: number, kind: CommentKind, targetId: number) {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(JSON.stringify([...queryScope(userId), "comment-hide", kind, targetId]));
}

export const commentKeys = {
  /** Every thread of one post/source/short; invalidate this after a comment is written. */
  target: (userId: number | null, kind: CommentKind, targetId: number) =>
    [...queryScope(userId), "comments", kind, targetId] as const,
  /** Top-level comments (`parentId` null) or the replies of one comment. */
  thread: (userId: number | null, kind: CommentKind, targetId: number, parentId: number | null) =>
    [...commentKeys.target(userId, kind, targetId), parentId] as const,
};

/** Offsets shift when comments are written between pages, so a comment repeated by a later page shows once. */
export function loadedComments(pages: readonly CommentPage[]): CommentItem[] {
  const seen = new Set<number>();
  return pages.flatMap((page) =>
    page.items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

export const commentPagesQuery = (
  userId: number | null,
  adapter: CommentAdapter,
  parentId: number | null,
) =>
  infiniteQueryOptions({
    queryKey: commentKeys.thread(userId, adapter.kind, adapter.targetId, parentId),
    queryFn: ({ pageParam, signal }) => adapter.load(parentId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.items.length > 0 && loadedComments(pages).length < last.total
        ? last.page + 1
        : undefined,
  });

/** Applies the server's reaction result to the comment wherever it is cached for the target. */
export function updateCachedReaction(
  client: QueryClient,
  userId: number | null,
  adapter: CommentAdapter,
  commentId: number,
  reaction: CommentReaction,
) {
  client.setQueriesData<InfiniteData<CommentPage, number>>(
    { queryKey: commentKeys.target(userId, adapter.kind, adapter.targetId) },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === commentId
              ? {
                  ...item,
                  isLiked: typeof reaction.isLiked === "boolean" ? reaction.isLiked : item.isLiked,
                  isDisliked:
                    typeof reaction.isDisliked === "boolean" ? reaction.isDisliked : item.isDisliked,
                  likes:
                    typeof reaction.likeCount === "number" && Number.isFinite(reaction.likeCount)
                      ? reaction.likeCount
                      : item.likes,
                  dislikes:
                    typeof reaction.dislikeCount === "number" &&
                    Number.isFinite(reaction.dislikeCount)
                      ? reaction.dislikeCount
                      : item.dislikes,
                }
              : item,
          ),
        })),
      },
  );
}

import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { queryScope } from "@/lib/query";
import { fetchPost, fetchPosts, getPopularPosts, type PostReaction } from "@/lib/api/community";
import type { PostDetailResponse, PostListItem, PostSort } from "@/lib/api/contracts";

export const POST_PAGE_SIZE = 20;

/** A gallery ID, or `"popular"` for the cross-gallery popular list (`GET /posts/popular`). */
export type PostListSource = number | "popular";
export type PostPage = { posts: PostListItem[]; totalCount: number };

export const postKeys = {
  all: (userId: number | null) => [...queryScope(userId), "posts"] as const,
  lists: (userId: number | null) => [...postKeys.all(userId), "list"] as const,
  list: (userId: number | null, source: PostListSource, sort: PostSort, keyword: string | null) =>
    [...postKeys.lists(userId), source, sort, keyword ?? ""] as const,
  detail: (userId: number | null, postId: number) =>
    [...postKeys.all(userId), "detail", postId] as const,
};

/** Public post detail with account-specific reaction and bookmark state when signed in. */
export function postDetailQuery(userId: number | null, postId: number) {
  return queryOptions({
    queryKey: postKeys.detail(userId, postId),
    queryFn: ({ signal }) => fetchPost(postId, signal),
  });
}

/**
 * Page-based post list. `sort`/`keyword` are applied by the server (list items carry no `content`), so another
 * condition is another list and starts again from the first page.
 */
export function postListQuery(
  userId: number | null,
  source: PostListSource,
  sort: PostSort,
  keyword: string | null,
) {
  return infiniteQueryOptions({
    queryKey: postKeys.list(userId, source, sort, keyword),
    queryFn: ({ pageParam, signal }): Promise<PostPage> =>
      source === "popular"
        ? getPopularPosts(pageParam, POST_PAGE_SIZE, signal)
        : fetchPosts(source, { sort, keyword, page: pageParam, size: POST_PAGE_SIZE }, signal),
    initialPageParam: 0,
    // Page progress, not the deduplicated item count, decides the end: overlapping pages shrink the visible count.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      (lastPageParam + 1) * POST_PAGE_SIZE < lastPage.totalCount ? lastPageParam + 1 : undefined,
  });
}

function updateListedPosts(
  client: QueryClient,
  userId: number | null,
  update: (posts: PostListItem[]) => PostListItem[],
) {
  client.setQueriesData<InfiniteData<PostPage, number>>(
    { queryKey: postKeys.lists(userId) },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({ ...page, posts: update(page.posts) })),
      },
  );
}

/** Applies a server reaction response to the cached detail and to the like counts of cached lists. */
export async function applyPostReaction(
  client: QueryClient,
  userId: number | null,
  postId: number,
  reaction: PostReaction,
) {
  // A read started before the write may still carry the old counts, even after the mutation succeeded.
  await Promise.all([
    client.cancelQueries({ queryKey: postKeys.detail(userId, postId), exact: true }),
    client.cancelQueries({ queryKey: postKeys.lists(userId) }),
  ]);
  client.setQueryData<PostDetailResponse>(
    postKeys.detail(userId, postId),
    (detail) => detail && { ...detail, ...reaction },
  );
  updateListedPosts(client, userId, (posts) =>
    posts.map((post) =>
      post.postId === postId ? { ...post, likeCount: reaction.likeCount } : post,
    ),
  );
}

/** Applies a confirmed bookmark change without letting an older detail response restore the previous state. */
export async function applyPostBookmark(
  client: QueryClient,
  userId: number | null,
  postId: number,
  isBookmarked: boolean,
) {
  await client.cancelQueries({ queryKey: postKeys.detail(userId, postId), exact: true });
  client.setQueryData<PostDetailResponse>(
    postKeys.detail(userId, postId),
    (detail) => detail && { ...detail, isBookmarked },
  );
}

/** Applies a saved edit to the cached detail; every list is marked stale for its next mount. */
export function applyPostEdit(
  client: QueryClient,
  userId: number | null,
  postId: number,
  title: string,
  content: string,
) {
  client.setQueryData<PostDetailResponse>(
    postKeys.detail(userId, postId),
    (detail) => detail && { ...detail, title, content },
  );
  void client.invalidateQueries({ queryKey: postKeys.lists(userId), refetchType: "none" });
}

/** Drops a deleted post from every cached list and its detail; lists are marked stale for their next mount. */
export function applyPostRemoval(client: QueryClient, userId: number | null, postId: number) {
  client.removeQueries({ queryKey: postKeys.detail(userId, postId) });
  updateListedPosts(client, userId, (posts) => posts.filter((post) => post.postId !== postId));
  void client.invalidateQueries({ queryKey: postKeys.lists(userId), refetchType: "none" });
}

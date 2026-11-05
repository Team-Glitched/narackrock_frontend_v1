import { apiRequest } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";

export type BookmarkedPost = {
  postId: number;
  gallery: { galleryId: number; name: string };
  writer: { userId: number; nickname: string | null; profileImageUrl: string | null };
  title: string;
  contentPreview: string;
  imageUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  bookmarkedAt: string;
};

export type BookmarkedShort = {
  shortId: number;
  title: string;
  albumImageUrl: string | null;
  completionStatus: string;
  author: { userId: number; nickname: string | null; profileImageUrl: string | null };
  likeCount: number;
  commentCount: number;
  bookmarkedAt: string;
};

const data = <T>(path: string, signal?: AbortSignal) =>
  apiRequest<ApiResponse<T>>(path, { signal }).then((response) => response.data);

/** Every bookmarked post, following page numbers until `totalCount` is reached. */
export async function listAllBookmarkedPosts(signal?: AbortSignal): Promise<BookmarkedPost[]> {
  const posts: BookmarkedPost[] = [];
  for (let page = 0; ; page++) {
    const result = await data<{ page: number; size: number; totalCount: number; posts: BookmarkedPost[] }>(
      `/api/v1/users/me/bookmarks/posts?page=${page}&size=50`,
      signal,
    );
    posts.push(...result.posts);
    if (result.posts.length === 0 || posts.length >= result.totalCount) return posts;
  }
}

/** Every bookmarked short, following the cursor until the server reports no more. */
export async function listAllBookmarkedShorts(signal?: AbortSignal): Promise<BookmarkedShort[]> {
  const shorts: BookmarkedShort[] = [];
  let cursor: number | null = null;
  for (;;) {
    const result: { items: BookmarkedShort[]; page: { nextCursor: number | null; hasMore: boolean } } = await data(
      `/api/v1/users/me/bookmarks/shorts?size=50${cursor === null ? "" : `&cursor=${cursor}`}`,
      signal,
    );
    shorts.push(...result.items);
    if (!result.page.hasMore || result.page.nextCursor === null || result.page.nextCursor === cursor) return shorts;
    cursor = result.page.nextCursor;
  }
}

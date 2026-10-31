import type { PostListResponse } from "../../lib/api/contracts.ts";

type FetchPosts = (
  galleryId: number,
  query: { keyword: string; size: number; page: number },
) => Promise<PostListResponse>;

/** A community search must never fall back to the global feed, even on empty results. */
export async function searchCommunityPosts(
  fetchPosts: FetchPosts,
  galleryId: number,
  keyword: string,
) {
  const trimmed = keyword.trim();
  if (!trimmed) return [];
  const posts: PostListResponse["posts"] = [];
  const seen = new Set<number>();
  let count = 0;
  for (let page = 0; ; page++) {
    const result = await fetchPosts(galleryId, { keyword: trimmed, size: 100, page });
    if (result.galleryId !== galleryId) throw new Error("커뮤니티 검색 결과를 확인할 수 없습니다.");
    let added = 0;
    for (const post of result.posts)
      if (!seen.has(post.postId)) {
        seen.add(post.postId);
        posts.push(post);
        added++;
      }
    count += result.posts.length;
    if (result.posts.length === 0 || added === 0 || count >= result.totalCount) break;
  }
  return posts;
}

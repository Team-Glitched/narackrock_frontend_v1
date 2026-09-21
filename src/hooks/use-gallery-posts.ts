"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPosts } from "@/lib/api/community";
import type { PostListItem, PostSort } from "@/lib/api/contracts";

export type GalleryPostsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; posts: PostListItem[]; totalCount: number };

export type GalleryPostsOptions = {
  sort?: PostSort;
  keyword?: string | null;
};

/**
 * 한 갤러리의 게시글 목록.
 *
 * `sort`/`keyword`는 서버가 처리한다 — 목록 응답에 `content`가 없어서(constraints-harness.md C6)
 * 클라이언트 필터링으로는 본문 검색을 흉내 낼 수 없고, 정렬도 현재 페이지 안에서만 맞게 된다.
 *
 * 로딩 상태를 effect에서 setState로 만들지 않고 **받아 둔 결과가 지금 조건의 것인지 비교해
 * 파생**한다. 조건이 바뀐 직후에는 손에 든 결과가 남의 것이므로 그대로 loading이다.
 * (community-membership.tsx의 loadedUserId와 같은 방식 — effect 안의 동기 setState는
 * 연쇄 렌더를 만든다.)
 */
export function useGalleryPosts(
  galleryId: number,
  { sort = "LATEST", keyword = null }: GalleryPostsOptions = {},
): GalleryPostsState & { refetch: () => void } {
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: GalleryPostsState } | null>(null);

  // 널 문자로 이어 붙여 "a|b"와 "a" + "|b"가 같은 키가 되는 일을 막는다.
  const queryKey = [galleryId, sort, keyword ?? "", reloadToken].join("\u0000");

  useEffect(() => {
    let cancelled = false;
    fetchPosts(galleryId, { sort, keyword })
      .then((result) => {
        if (!cancelled) {
          setLoaded({ key: queryKey, state: { status: "ready", posts: result.posts, totalCount: result.totalCount } });
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: queryKey, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId, sort, keyword, queryKey]);

  const state: GalleryPostsState = loaded?.key === queryKey ? loaded.state : { status: "loading" };
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}

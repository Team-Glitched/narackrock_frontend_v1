import { useCallback, useEffect, useMemo, useState } from "react";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { fetchPosts } from "@/lib/api/community";
import type { PostListItem, PostSort } from "@/lib/api/contracts";

const PAGE_SIZE = 20;

export type GalleryPostsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; posts: PostListItem[]; totalCount: number; loadedPages: number };

export type GalleryPostsOptions = {
  sort?: PostSort;
  keyword?: string | null;
};

export type GalleryPosts = GalleryPostsState & {
  /** 처음부터 다시 받는다. 글 작성·삭제 뒤처럼 목록이 통째로 달라졌을 때 쓴다. */
  refetch: () => void;
  /** 아직 받지 않은 게시글이 남아 있는지. */
  hasMore: boolean;
  /** 다음 페이지를 받는 중. */
  appending: boolean;
  /** 다음 페이지를 받다 실패했는지. 다시 부르면 같은 페이지를 재시도한다. */
  appendFailed: boolean;
  loadMore: () => void;
};

type Loaded = { key: string; state: GalleryPostsState };

/**
 * 한 갤러리의 게시글 목록. 페이지를 이어 붙이는 무한 스크롤용이다.
 *
 * `sort`/`keyword`는 서버가 처리한다 — 목록 응답에 `content`가 없어서(constraints-harness.md C6)
 * 클라이언트 필터링으로는 본문 검색을 흉내 낼 수 없고, 정렬도 받아 둔 페이지 안에서만 맞게 된다.
 *
 * 조건(갤러리·정렬·검색어)이 바뀌면 **이어 붙이지 않고 처음부터 다시 받는다.** 다른 목록이기
 * 때문이다. 로딩 상태는 effect에서 setState로 만들지 않고, 받아 둔 결과가 지금 조건의
 * 것인지 키로 비교해 파생한다(community-membership.tsx의 loadedUserId와 같은 방식).
 */
export function useGalleryPosts(
  galleryId: number,
  { sort = "LATEST", keyword = null }: GalleryPostsOptions = {},
): GalleryPosts {
  const { ids: hiddenPosts } = useHiddenPosts();
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // 진행 중/실패를 조건 키와 함께 들고 있어야, 조건이 바뀐 뒤 도착한 결과에 반응하지 않는다.
  const [appendingKey, setAppendingKey] = useState<string | null>(null);
  const [appendFailedKey, setAppendFailedKey] = useState<string | null>(null);

  // 널 문자로 이어 붙여 "a|b"와 "a" + "|b"가 같은 키가 되는 일을 막는다.
  const queryKey = [galleryId, sort, keyword ?? "", reloadToken].join("\u0000");

  useEffect(() => {
    let cancelled = false;
    fetchPosts(galleryId, { sort, keyword, page: 0, size: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setLoaded({
          key: queryKey,
          state: { status: "ready", posts: result.posts, totalCount: result.totalCount, loadedPages: 1 },
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: queryKey, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId, sort, keyword, queryKey]);

  // loadMore가 이 값을 의존성으로 쓰므로, 매 렌더 새 객체가 되지 않도록 메모한다.
  const state = useMemo<GalleryPostsState>(
    () => (loaded?.key === queryKey ? loaded.state : { status: "loading" }),
    [loaded, queryKey],
  );
  const appending = appendingKey === queryKey;
  const appendFailed = appendFailedKey === queryKey;
  // 중복 제거 후 표시된 개수는 서버 페이지의 진행도를 나타내지 않는다.
  // 페이지 사이에 새 글이 삽입되면 같은 글이 겹쳐, 끝까지 받아도 표시 개수가 totalCount보다 작을 수 있다.
  const hasMore = state.status === "ready" && state.loadedPages * PAGE_SIZE < state.totalCount;

  const loadMore = useCallback(() => {
    if (state.status !== "ready" || appending) return;
    if (state.loadedPages * PAGE_SIZE >= state.totalCount) return;

    const key = queryKey;
    const nextPage = state.loadedPages;
    setAppendingKey(key);
    setAppendFailedKey(previous => (previous === key ? null : previous));

    fetchPosts(galleryId, { sort, keyword, page: nextPage, size: PAGE_SIZE })
      .then((result) => {
        setLoaded((previous) => {
          // 받는 사이에 조건이 바뀌었으면 남의 결과다. 버린다.
          if (!previous || previous.key !== key || previous.state.status !== "ready") return previous;
          // page/size 기반이라 받는 사이 새 글이 올라오면 앞 페이지와 겹칠 수 있다.
          // 같은 글이 두 번 그려지면 React key도 중복되므로 id로 거른다.
          const seen = new Set(previous.state.posts.map(post => post.postId));
          const added = result.posts.filter(post => !seen.has(post.postId));
          return {
            key,
            state: {
              status: "ready",
              posts: [...previous.state.posts, ...added],
              totalCount: result.totalCount,
              loadedPages: previous.state.loadedPages + 1,
            },
          };
        });
      })
      .catch(() => setAppendFailedKey(key))
      .finally(() => setAppendingKey(previous => (previous === key ? null : previous)));
  }, [appending, galleryId, keyword, queryKey, sort, state]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  const visibleState = state.status === "ready" ? { ...state, posts: state.posts.filter(post => !hiddenPosts.has(post.postId)) } : state;
  return { ...visibleState, refetch, hasMore, appending, appendFailed, loadMore };
}

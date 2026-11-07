import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { postKeys, postListQuery, type PostListSource } from "@/features/posts/post-queries";
import type { PostListItem, PostSort } from "@/lib/api/contracts";

export type GalleryPostsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; posts: PostListItem[] };

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

/**
 * 한 갤러리의 게시글 목록. 페이지를 이어 붙이는 무한 스크롤용이다.
 *
 * `sort`/`keyword`는 서버가 처리한다 — 목록 응답에 `content`가 없어서(constraints-harness.md C6)
 * 클라이언트 필터링으로는 본문 검색을 흉내 낼 수 없고, 정렬도 받아 둔 페이지 안에서만 맞게 된다.
 * 조건(갤러리·정렬·검색어)은 쿼리 키라서, 바뀌면 이어 붙이지 않고 그 조건의 목록을 처음부터 받는다.
 */
export function useGalleryPosts(
  /** A gallery ID, or `"popular"` for the cross-gallery popular list (`GET /posts/popular`). */
  galleryId: PostListSource,
  { sort = "LATEST", keyword = null }: GalleryPostsOptions = {},
): GalleryPosts {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { ids: hiddenPosts } = useHiddenPosts();
  const query = useInfiniteQuery(postListQuery(userId, galleryId, sort, keyword));
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;

  // page/size 기반이라 받는 사이 새 글이 올라오면 앞 페이지와 겹칠 수 있다.
  // 같은 글이 두 번 그려지면 React key도 중복되므로 id로 거른다.
  const posts = useMemo(() => {
    if (!data) return null;
    const seen = new Set<number>();
    return data.pages
      .flatMap((page) => page.posts)
      .filter((post) => {
        if (seen.has(post.postId)) return false;
        seen.add(post.postId);
        return true;
      });
  }, [data]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // 받아 둔 페이지를 버리고 첫 페이지부터 다시 받는다(그동안은 불러오는 중으로 보인다).
  const refetch = useCallback(() => {
    void queryClient.resetQueries({ queryKey: postKeys.list(userId, galleryId, sort, keyword), exact: true });
  }, [galleryId, keyword, queryClient, sort, userId]);

  const state: GalleryPostsState = posts
    ? { status: "ready", posts: posts.filter((post) => !hiddenPosts.has(post.postId)) }
    : query.isError
      ? { status: "error" }
      : { status: "loading" };
  return {
    ...state,
    refetch,
    hasMore: posts !== null && hasNextPage,
    appending: isFetchingNextPage,
    // 재시도가 시작되면 실패 표시는 내린다.
    appendFailed: isFetchNextPageError && !isFetchingNextPage,
    loadMore,
  };
}

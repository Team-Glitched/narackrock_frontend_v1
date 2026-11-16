import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { MiniPost } from "@/features/posts/post-list";
import { postDetailQuery } from "@/features/posts/post-queries";
import { ApiError } from "@/lib/api/client";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { likedPostIdsQuery } from "./profile-queries";

const PAGE_SIZE = 20;

/** The signed-in user's liked posts, loaded PAGE_SIZE details at a time. */
export function useLikedPosts() {
  const userId = useCurrentUserId();
  const idsQuery = useQuery({ ...likedPostIdsQuery(userId), enabled: userId !== null });
  const [requested, setRequested] = useState(PAGE_SIZE);
  const ids = idsQuery.data;
  const loaded = Math.min(requested, ids?.length ?? 0);
  const details = useQueries({ queries: (ids ?? []).slice(0, loaded).map((id) => postDetailQuery(userId, id)) });

  const loading = details.some((detail) => detail.isPending || (detail.isError && detail.isFetching));
  const idsError = idsQuery.isError && !idsQuery.isFetching
    ? idsQuery.error instanceof Error ? idsQuery.error.message : "좋아요 목록을 불러오지 못했습니다." : null;
  const status = (error: unknown) => error instanceof ApiError && error.status === 404 ? "deleted"
    : error instanceof ApiError && error.status === 403 ? "forbidden" : "failed";
  const failed = details.filter((detail) => detail.isError && status(detail.error) === "failed");
  const forbidden = details.some((detail) => detail.isError && status(detail.error) === "forbidden");
  const posts = details.flatMap((detail) => detail.data ? [detail.data] : []);
  return { idsQuery, ids, loaded, loading, idsError, failed, forbidden, posts, more: () => setRequested(loaded + PAGE_SIZE) };
}

export function LikedPostsScreen({ onOpenPost }: { onOpenPost: (postId: number) => void }) {
  const { idsQuery, ids, loaded, loading, idsError, failed, forbidden, posts, more } = useLikedPosts();
  return (
    <section className={cn(sharedStyles.listView, sharedStyles.scrollContent, "flex flex-col gap-4 pb-10")}>
      {posts.length > 0 && <h1 className={cn(sharedStyles.postsListTitle, "mb-0!")}>좋아요한 게시글</h1>}
      {!ids && !idsError ? (
        <p role="status" className="my-auto flex flex-1 items-center justify-center px-5 py-12 text-center text-label leading-6 text-app-muted">
          목록을 불러오는 중...
        </p>
      ) : null}
      {idsError && (
        <div
          role="alert"
          className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted"
        >
          <p className="m-0">{idsError}</p>
          <button
            className={buttonVariants({ tone: "secondary" })}
            onClick={() => void idsQuery.refetch()}
          >
            다시 시도
          </button>
        </div>
      )}
      {forbidden && (
        <p role="status" className="mx-5 rounded-xl border border-solid border-app-border px-4 py-3 text-label leading-6 text-app-muted">
          일부 게시글은 접근 권한이 없어 표시할 수 없습니다.
        </p>
      )}
      {posts.length > 0 && (
        <div className={communityStyles.miniPostList}>
          {posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)}
        </div>
      )}
      {ids && !loading && !idsError && posts.length === 0 && failed.length === 0 && (
        <div className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted">
          <p className="m-0">
            {loaded < ids.length ? "다음 목록을 확인해 주세요." : "표시할 좋아요 게시글이 없습니다."}
          </p>
          <button
            type="button"
            className={buttonVariants({ tone: "secondary" })}
            disabled={idsQuery.isFetching || loading}
            onClick={() => void idsQuery.refetch()}
          >
            새로고침
          </button>
        </div>
      )}
      {failed.length > 0 && (
        <div
          role="alert"
          className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted"
        >
          <p className="m-0">{failed.length}개 게시글을 불러오지 못했습니다.</p>
          <button
            className={buttonVariants({ tone: "secondary" })}
            disabled={loading}
            onClick={() => {
              for (const detail of failed) void detail.refetch();
            }}
          >
            실패한 게시글 다시 시도
          </button>
        </div>
      )}
      {ids && loaded < ids.length && (
        <button
          className="mx-5 my-2 min-h-11 rounded-full bg-app-surface px-5 py-2.5 text-label font-medium text-app-fg disabled:opacity-50"
          disabled={loading}
          onClick={more}
        >
          {loading ? "불러오는 중..." : "더보기"}
        </button>
      )}
    </section>
  );
}

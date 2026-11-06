import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { MiniPost } from "@/features/posts/post-list";
import { postDetailQuery } from "@/features/posts/post-queries";
import { ApiError } from "@/lib/api/client";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { likedPostIdsQuery } from "./profile-queries";

const PAGE_SIZE = 20;

export function LikedPostsScreen({ onOpenPost }: { onOpenPost: (postId: number) => void }) {
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
  return (
    <section className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>좋아요한 게시글</h1>
      {!ids && !idsError ? <p role="status">목록을 불러오는 중...</p> : null}
      {idsError && <div role="alert"><p>{idsError}</p><button onClick={() => void idsQuery.refetch()}>다시 시도</button></div>}
      {forbidden && <p role="status">일부 게시글은 접근 권한이 없어 표시할 수 없습니다.</p>}
      <div className={communityStyles.miniPostList}>
        {posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)}
      </div>
      {ids && !loading && !idsError && posts.length === 0 && failed.length === 0 &&
        <p>{loaded < ids.length ? "다음 목록을 확인해 주세요." : "표시할 좋아요 게시글이 없습니다."}</p>}
      {failed.length > 0 && <div role="alert"><p>{failed.length}개 게시글을 불러오지 못했습니다.</p>
        <button disabled={loading} onClick={() => {
          for (const detail of failed) void detail.refetch();
        }}>실패한 게시글 다시 시도</button></div>}
      {ids && loaded < ids.length && <button
        className="my-5 min-h-11 w-full rounded-lg bg-app-surface px-4 py-2" disabled={loading}
        onClick={() => setRequested(loaded + PAGE_SIZE)}>
        {loading ? "불러오는 중..." : "더보기"}
      </button>}
    </section>
  );
}

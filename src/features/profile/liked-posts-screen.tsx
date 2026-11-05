import { useEffect, useRef, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { MiniPost } from "@/features/posts/post-list";
import { ApiError, apiOrigin } from "@/lib/api/client";
import { fetchPost, getLikedPostIds } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";

type Result = { status: "ready"; post: PostListItem } | { status: "deleted" | "forbidden" | "failed" };
type State = { scope: string; ids: number[] | null; loaded: number; results: Map<number, Result>;
  loading: boolean; error: string | null };

export function LikedPostsScreen({ onOpenPost }: { onOpenPost: (postId: number) => void }) {
  const userId = useCurrentUserId();
  const scope = JSON.stringify([apiOrigin(), userId]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const active = useRef<{ scope: string; cancelled: boolean; busy: boolean } | null>(null);

  async function hydrate(request: NonNullable<typeof active.current>, ids: number[], loaded: number) {
    request.busy = true;
    setState((current) => current?.scope === request.scope ? { ...current, loading: true } : current);
    const entries = await Promise.all(ids.map(async (id): Promise<[number, Result]> => {
      try { return [id, { status: "ready", post: await fetchPost(id) }]; }
      catch (cause) { return [id, { status: cause instanceof ApiError && cause.status === 404 ? "deleted"
        : cause instanceof ApiError && cause.status === 403 ? "forbidden" : "failed" }]; }
    }));
    if (request.cancelled || active.current !== request) return;
    setState((current) => current?.scope === request.scope ? {
      ...current, loaded, loading: false, results: new Map([...current.results, ...entries]),
    } : current);
    request.busy = false;
  }

  useEffect(() => {
    if (userId === null) return;
    const request = { scope, cancelled: false, busy: true };
    active.current = request;
    setState({ scope, ids: null, loaded: 0, results: new Map(), loading: true, error: null });
    getLikedPostIds().then(async (response) => {
      if (request.cancelled || active.current !== request) return;
      const ids = [...new Set(response)];
      setState({ scope, ids, loaded: 0, results: new Map(), loading: true, error: null });
      await hydrate(request, ids.slice(0, 20), Math.min(20, ids.length));
    }).catch((cause: unknown) => {
      if (request.cancelled || active.current !== request) return;
      request.busy = false;
      setState({ scope, ids: null, loaded: 0, results: new Map(), loading: false,
        error: cause instanceof Error ? cause.message : "좋아요 목록을 불러오지 못했습니다." });
    });
    return () => { request.cancelled = true; if (active.current === request) active.current = null; };
  }, [scope, userId, revision]);

  const visible = state?.scope === scope ? state : null;
  const failed = visible?.ids?.filter((id) => visible.results.get(id)?.status === "failed") ?? [];
  const forbidden = [...visible?.results.values() ?? []].some((result) => result.status === "forbidden");
  const posts = visible?.ids?.flatMap((id) => {
    const result = visible.results.get(id);
    return result?.status === "ready" ? [result.post] : [];
  }) ?? [];
  const loadMore = () => {
    const request = active.current;
    if (!request || request.scope !== scope || request.busy || !visible?.ids) return;
    const end = Math.min(visible.loaded + 20, visible.ids.length);
    void hydrate(request, visible.ids.slice(visible.loaded, end), end);
  };
  return (
    <section className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>좋아요한 게시글</h1>
      {!visible || (visible.loading && visible.ids === null) ? <p role="status">목록을 불러오는 중...</p> : null}
      {visible?.error && <div role="alert"><p>{visible.error}</p><button onClick={() => setRevision((value) => value + 1)}>다시 시도</button></div>}
      {forbidden && <p role="status">일부 게시글은 접근 권한이 없어 표시할 수 없습니다.</p>}
      <div className={communityStyles.miniPostList}>
        {posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)}
      </div>
      {visible?.ids && !visible.loading && !visible.error && posts.length === 0 && failed.length === 0 &&
        <p>{visible.loaded < visible.ids.length ? "다음 목록을 확인해 주세요." : "표시할 좋아요 게시글이 없습니다."}</p>}
      {failed.length > 0 && <div role="alert"><p>{failed.length}개 게시글을 불러오지 못했습니다.</p>
        <button disabled={visible?.loading} onClick={() => {
          const request = active.current;
          if (request && request.scope === scope && !request.busy && visible) void hydrate(request, failed, visible.loaded);
        }}>실패한 게시글 다시 시도</button></div>}
      {visible?.ids && visible.loaded < visible.ids.length && <button
        className="my-5 min-h-11 w-full rounded-lg bg-app-surface px-4 py-2" disabled={visible.loading} onClick={loadMore}>
        {visible.loading ? "불러오는 중..." : "더보기"}
      </button>}
    </section>
  );
}

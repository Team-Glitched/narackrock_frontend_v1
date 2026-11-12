import { sourceStyles } from "@/styles/source.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionTitle } from "@/components/section-title";
import { Avatar } from "@/components/avatar";
import { PageState } from "@/components/page-state";
import { PostActions } from "@/features/posts/post-actions";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SourcePlayback } from "@/features/sources/source-playback";
import { ApiError } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { useShareLink } from "@/hooks/use-share-link";
import { relativeTime } from "@/features/posts/post-utils";
import { recommendByAuthor } from "@/features/community/discovery";
import {
  createOpenSourceComment,
  getOpenSourceComments,
  hideOpenSourceComment,
  getOpenSourceShare,
  reactToOpenSource,
  reactToOpenSourceComment,
  type OpenSourceDetail,
  type OpenSourceSummary,
} from "@/lib/api/open-sources";
import {
  openSourceListQuery,
  openSourceQuery,
  patchSource,
  popularOpenSourcesQuery,
  sourceDiscoverySize,
  sourceKeys,
  useSourceSaveMutation,
} from "./source-queries";

export function sourceError(cause: unknown, fallback = "샘플을 불러오지 못했습니다.") {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    if (cause.status === 403) return "이 샘플에 접근할 권한이 없습니다.";
    if (cause.status === 404) return "삭제되었거나 비공개인 샘플입니다.";
    return cause.message || fallback;
  }
  return cause instanceof TypeError ? "서버에 연결하지 못했습니다. 네트워크를 확인해주세요." : fallback;
}

/** Server save state of one source, updated only from the PUT/DELETE response. */
function useSourceSave(source: Pick<OpenSourceSummary, "openSourceId" | "isSaved">) {
  const mutation = useSourceSaveMutation();
  return {
    saved: source.isSaved,
    busy: mutation.isPending,
    error: mutation.error ? sourceError(mutation.error, "보관함을 변경하지 못했습니다.") : "",
    toggle: () => {
      if (!mutation.isPending) mutation.mutate({ sourceId: source.openSourceId, saved: !source.isSaved });
    },
  };
}

function SaveButton({ save }: { save: ReturnType<typeof useSourceSave> }) {
  return (
    <button
      className={cn(buttonVariants({ tone: "primary" }), sourceStyles.osSaveButton)}
      aria-pressed={save.saved}
      disabled={save.busy}
      onClick={save.toggle}
    >
      {save.saved ? "저장됨" : "저장"}
    </button>
  );
}

function OpenSourceCard({
  source,
  onOpen,
  onProfile,
}: {
  source: OpenSourceSummary;
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const save = useSourceSave(source);
  return (
    <article className={sourceStyles.osCard}>
      <div className={sourceStyles.osHead}>
        <button className={sourceStyles.osAuthor} onClick={() => onOpen(source.openSourceId)} aria-label={`${source.title} 보기`}>
          <Avatar src={source.thumbnailUrl} />
          <span>
            <strong>{source.title}</strong>
            {source.usageCount != null && <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>}
          </span>
        </button>
        <SaveButton save={save} />
      </div>
      {save.error && <p role="alert">{save.error}</p>}
      <button className={sourceStyles.osBody} onClick={() => onOpen(source.openSourceId)}>
        {source.description ?? ""}
      </button>
      <SourcePlayback
        sourceId={source.openSourceId}
        canPreview={source.canPreview ?? true}
        durationMs={null}
        label={source.title}
        showDurationHint={false}
      />
      <div className={sourceStyles.osFoot}>
        <button className={sourceStyles.osFootAuthor} onClick={() => onProfile(source.writer.userId)}>
          <Avatar src={source.writer.profileImageUrl} />
          <span>{source.writer.nickname}</span>
        </button>
        <PostActions
          compact
          readOnly
          likeCount={source.likeCount}
          dislikeCount={source.dislikeCount}
          commentCount={source.commentCount}
          vote={source.isLiked ? "like" : source.isDisliked ? "dislike" : null}
          onVote={() => undefined}
          onComments={() => onOpen(source.openSourceId, true)}
        />
      </div>
    </article>
  );
}

/** Paged public source list for a keyword; following pages are appended until the server reports no more. */
export function useOpenSourceList(keyword: string, enabled: boolean) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const options = openSourceListQuery(userId, keyword.trim());
  const query = useInfiniteQuery({ ...options, enabled: enabled && userId !== null });
  const { data, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } = query;
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (data?.pages ?? []).flatMap((page) => page.items).filter((item) => {
      if (seen.has(item.openSourceId)) return false;
      seen.add(item.openSourceId);
      return true;
    });
  }, [data]);
  const state =
    data || (error && !isFetching)
      ? { items, hasNext: hasNextPage, error: error ? sourceError(error) : undefined }
      : null;
  return {
    state,
    firstPage: data?.pages[0]?.items,
    userId,
    more: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    moreBusy: isFetchingNextPage,
    retry: () => void queryClient.resetQueries({ queryKey: options.queryKey, exact: true }),
    signedIn: userId !== null,
  };
}

function discoveryCardStep(track: HTMLDivElement) {
  const nextCard = track.children[1];
  return nextCard instanceof HTMLElement ? nextCard.offsetLeft : track.clientWidth;
}

function SourceDiscoveryRail({
  title,
  items,
  error,
  retry,
  onOpen,
  onProfile,
}: {
  title: string;
  items?: OpenSourceSummary[];
  error?: string;
  retry: () => void;
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const railId = useId();
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    left: number;
    scale: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [page, setPage] = useState(0);
  const count = items?.length ?? 0;
  const index = Math.max(0, Math.min(page, count - 1));

  function moveTo(next: number) {
    const track = rail.current;
    if (track) track.scrollTo({ left: next * discoveryCardStep(track) });
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (count < 2 || event.pointerType !== "mouse" || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("input")) return;
    const track = event.currentTarget;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: track.scrollLeft,
      scale: track.getBoundingClientRect().width / track.clientWidth,
      active: false,
    };
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = (start.x - event.clientX) / start.scale;
    const track = event.currentTarget;
    if (!start.active) {
      if (Math.abs(distance) < 6) return;
      start.active = true;
      suppressClick.current = true;
      track.setPointerCapture(event.pointerId);
      track.dataset.dragging = "true";
    }
    track.scrollTo({ left: start.left + distance, behavior: "instant" });
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!start.active) return;
    const track = event.currentTarget;
    const step = discoveryCardStep(track);
    const initial = Math.round(start.left / step);
    const nearest = Math.round(track.scrollLeft / step);
    const distance = (start.x - event.clientX) / start.scale;
    // A short mouse swipe advances a card even if it stops before the midpoint.
    const next = event.type === "pointerup" && nearest === initial && Math.abs(distance) >= 40
      ? initial + Math.sign(distance)
      : nearest;
    delete track.dataset.dragging;
    moveTo(Math.max(0, Math.min(next, count - 1)));
  }

  return (
    <section aria-label={title}>
      <div className="mb-4 flex min-h-9 items-center justify-between gap-2">
        <h2 className="m-0 text-title leading-6 font-bold tracking-[-0.4px]">{title}</h2>
        {count > 1 && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span role="status" className="mr-1 text-caption text-app-muted tabular-nums">
              <span className="sr-only">{title} </span>
              {index + 1} / {count}
            </span>
            <button
              type="button"
              className={sourceStyles.osDiscoveryArrow}
              aria-label={`${title} 이전 카드`}
              aria-controls={railId}
              disabled={index === 0}
              onClick={() => moveTo(index - 1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={sourceStyles.osDiscoveryArrow}
              aria-label={`${title} 다음 카드`}
              aria-controls={railId}
              disabled={index === count - 1}
              onClick={() => moveTo(index + 1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {!items && (
        error ? (
          <div role="alert">
            <p>{error}</p>
            <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={retry}>
              다시 시도
            </button>
          </div>
        ) : <p role="status">샘플을 불러오는 중...</p>
      )}
      {items?.length === 0 && <p className={sourceStyles.osDiscoveryEmpty}>표시할 샘플이 없습니다.</p>}
      {!!items?.length && (
        <div
          id={railId}
          ref={rail}
          className={sourceStyles.osDiscoveryRail}
          data-paged={count > 1}
          onScroll={({ currentTarget: track }) => {
            const step = discoveryCardStep(track);
            if (step) setPage(Math.round(track.scrollLeft / step));
          }}
          onPointerDown={startDrag}
          onPointerMove={updateDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onPointerLeave={(event) => {
            if (drag.current?.pointerId === event.pointerId && !drag.current.active) drag.current = null;
          }}
          onClickCapture={(event) => {
            if (!suppressClick.current || event.detail === 0) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {items.map((source) => (
            <OpenSourceCard key={source.openSourceId} source={source} onOpen={onOpen} onProfile={onProfile} />
          ))}
        </div>
      )}
    </section>
  );
}

export function OpensourceScreen({
  onOpen,
  onProfile,
}: {
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const list = useOpenSourceList("", true);
  const popular = useQuery({ ...popularOpenSourcesQuery(list.userId), enabled: list.signedIn });
  if (!list.signedIn) return <SignInRequired>샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  const { state } = list;
  const recommended = list.firstPage &&
    recommendByAuthor(list.firstPage, (item) => item.writer.userId, list.userId).slice(0, sourceDiscoverySize);
  return (
    <div className={cn(sourceStyles.opensourceView, sharedStyles.scrollContent, sourceStyles.osDiscoverySections)}>
      <SourceDiscoveryRail
        title="인기 오픈소스"
        items={popular.data?.items}
        error={popular.error ? sourceError(popular.error) : undefined}
        retry={() => void popular.refetch()}
        onOpen={onOpen}
        onProfile={onProfile}
      />
      <SourceDiscoveryRail
        title="추천 오픈소스"
        items={recommended}
        error={state?.error}
        retry={list.retry}
        onOpen={onOpen}
        onProfile={onProfile}
      />
      <section aria-label="전체 샘플">
        <SectionTitle>전체 샘플</SectionTitle>
        {!state && <p role="status">샘플을 불러오는 중...</p>}
        {state?.error && (
          <div role="alert">
            <p>{state.error}</p>
            <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={list.retry}>
              다시 시도
            </button>
          </div>
        )}
        {state && !state.error && state.items.length === 0 && (
          <p className={sourceStyles.osDiscoveryEmpty}>아직 공개된 샘플이 없습니다.</p>
        )}
        {state && state.items.length > 0 && (
          <div className={sourceStyles.osDiscoveryList}>
            {state.items.map((source) => (
              <OpenSourceCard key={source.openSourceId} source={source} onOpen={onOpen} onProfile={onProfile} />
            ))}
          </div>
        )}
        {state?.hasNext && (
          <button className={communityStyles.nrCommentsMore} disabled={list.moreBusy} onClick={() => void list.more()}>
            {list.moreBusy ? "불러오는 중..." : "더보기"}
          </button>
        )}
      </section>
    </div>
  );
}

function SourceDetail({
  source,
  onComments,
  onProfile,
}: {
  source: OpenSourceDetail;
  onComments: () => void;
  onProfile: (id: number) => void;
}) {
  const save = useSourceSave(source);
  const sharing = useShareLink();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const reaction = useMutation({
    mutationFn: (kind: "like" | "dislike") => reactToOpenSource(source.openSourceId, kind),
    onSuccess: (result) => {
      patchSource(queryClient, userId, source.openSourceId, result);
      void queryClient.invalidateQueries({ queryKey: sourceKeys.popular(userId) });
    },
  });
  const [notice, setNotice] = useState("");
  function vote(kind: "like" | "dislike") {
    if (reaction.isPending) return;
    setNotice("");
    reaction.mutate(kind, { onError: (cause) => setNotice(sourceError(cause, "반응을 반영하지 못했습니다.")) });
  }
  async function share() {
    setNotice("");
    try {
      const { shareUrl } = await getOpenSourceShare(source.openSourceId);
      const link = canonicalShareLink("source", source.openSourceId, shareUrl, window.location.origin);
      setNotice((await sharing.share(source.title, link)) ?? "");
    } catch (cause) {
      setNotice(
        cause instanceof DOMException
          ? "공유 링크를 복사하지 못했습니다."
          : cause instanceof Error && !(cause instanceof ApiError) && !(cause instanceof TypeError)
            ? cause.message
            : sourceError(cause, "공유 링크를 만들지 못했습니다."),
      );
    }
  }
  return (
    <div className={sourceStyles.opensourceDetail}>
      {sharing.dialog}
      <section className={sourceStyles.osDetailArticle}>
        <div className={sourceStyles.osDetailTitleRow}>
          <div className={sourceStyles.osDetailTitle}>
            <Avatar src={source.thumbnailUrl} />
            <span>
              <strong>{source.title}</strong>
              {source.usageCount != null && <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>}
            </span>
          </div>
          <SaveButton save={save} />
        </div>
        {save.error && <p role="alert">{save.error}</p>}
        <button className={sourceStyles.osDetailByline} onClick={() => onProfile(source.writer.userId)}>
          <Avatar src={source.writer.profileImageUrl} />
          <span>{source.writer.nickname}</span>
        </button>
        <p className={sourceStyles.osDetailCopy}>{source.description ?? ""}</p>
        <SourcePlayback sourceId={source.openSourceId} canPreview={source.canPreview} durationMs={source.durationMs} />
        <p className={sourceStyles.osDiscoveryEmpty}>보관한 뒤 피아노롤의 ‘+ 샘플’에서 내 레이어에 오디오로 넣을 수 있습니다.</p>
        <PostActions
          likeCount={source.likeCount}
          dislikeCount={source.dislikeCount}
          commentCount={source.commentCount}
          vote={source.isLiked ? "like" : source.isDisliked ? "dislike" : null}
          onVote={vote}
          busy={reaction.isPending || save.busy}
          onComments={onComments}
          saved={save.saved}
          onSave={save.toggle}
          onShare={() => void share()}
        />
        {notice && <p role="status">{notice}</p>}
      </section>
      <div className={communityStyles.nrPostCommentDivider} />
    </div>
  );
}

export function OpensourceDetailScreen({
  sourceId,
  focusComments,
  onProfile,
}: {
  sourceId: number;
  focusComments: boolean;
  onProfile: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const query = useQuery({ ...openSourceQuery(userId, sourceId), enabled: userId !== null });
  const refreshSource = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(userId, sourceId) });
  }, [queryClient, userId, sourceId]);
  const [focus, setFocus] = useState(focusComments ? 1 : 0);
  const adapter = useMemo<CommentAdapter>(
    () => ({
      kind: "sources",
      targetId: sourceId,
      async load(parentId, page, signal) {
        const result = await getOpenSourceComments(sourceId, parentId, page, signal);
        return {
          page: result.page,
          total: result.totalCount,
          items: result.comments.map((comment) => ({
            id: comment.commentId,
            parentId: comment.parentCommentId,
            userId: comment.writer.userId,
            author: comment.writer.nickname,
            avatarUrl: comment.writer.profileImageUrl,
            text: comment.content,
            time: relativeTime(comment.createdAt),
            replyCount: comment.replyCount,
            likes: comment.likeCount,
            dislikes: comment.dislikeCount,
            isLiked: comment.isLiked,
            isDisliked: comment.isDisliked,
          })),
        };
      },
      create: (text, parentId) => createOpenSourceComment(sourceId, text, parentId),
      react: reactToOpenSourceComment,
      hide: hideOpenSourceComment,
    }),
    [sourceId],
  );
  if (userId === null) return <SignInRequired>샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  const source = query.data;
  if (!source && (!query.error || query.isFetching)) return <PageState>샘플을 불러오는 중...</PageState>;
  if (!source)
    return (
      <PageState error>
        <span className="grid gap-3">
          <span>{sourceError(query.error)}</span>
          <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={() => void query.refetch()}>
            다시 시도
          </button>
        </span>
      </PageState>
    );
  return (
    <div className={sourceStyles.opensourceDetailShell}>
      <CommonComments
        adapter={adapter}
        currentUserId={userId}
        onProfile={onProfile}
        focus={focus}
        // The detail's comment count is server-owned: reread it after a comment is added or removed.
        onChanged={refreshSource}
        header={<SourceDetail source={source} onComments={() => setFocus((value) => value + 1)} onProfile={onProfile} />}
      />
    </div>
  );
}

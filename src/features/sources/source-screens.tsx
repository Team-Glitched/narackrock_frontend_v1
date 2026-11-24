import { partLabel } from "@/features/composition/instrument-parts";
import { sourceStyles } from "@/styles/source.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { AlbumArtwork } from "@/components/music-card";
import { SectionTitle } from "@/components/section-title";
import { Avatar } from "@/components/avatar";
import { FigmaSheet } from "@/components/figma-sheet";
import { PageState } from "@/components/page-state";
import { PostActions } from "@/features/posts/post-actions";
import { CommentsView } from "@/features/comments/common-comments";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useComments, type CommentsState } from "@/features/comments/use-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SourcePlayback } from "@/features/sources/source-playback";
import { NativeSourceDetailBridge } from "@/features/sources/native-source-detail-bridge";
import { nativeApp } from "@/lib/native-app";
import { ApiError } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { publicWebOrigin } from "@/lib/public-web-origin";
import { useShareLink } from "@/hooks/use-share-link";
import { relativeTime } from "@/features/posts/post-utils";
import {
  createOpenSourceComment,
  deleteOpenSourceComment,
  getOpenSourceComments,
  hideOpenSourceComment,
  getOpenSourceShare,
  reactToOpenSource,
  reactToOpenSourceComment,
  updateOpenSourceComment,
  type OpenSourceDetail,
  type OpenSourceSummary,
} from "@/lib/api/open-sources";
import { reportOpenSource, reportOpenSourceComment } from "@/lib/api/reports";
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
  return cause instanceof TypeError
    ? "서버에 연결하지 못했습니다. 네트워크를 확인해주세요."
    : fallback;
}

/** "사용 수 1,234". */
export const sourceUsage = (count: number) => `사용 수 ${count.toLocaleString("ko-KR")}`;

/** Server save state of one source, updated only from the PUT/DELETE response. */
export function useSourceSave(source: Pick<OpenSourceSummary, "openSourceId" | "isSaved">) {
  const mutation = useSourceSaveMutation();
  return {
    saved: source.isSaved,
    busy: mutation.isPending,
    error: mutation.error ? sourceError(mutation.error, "보관함을 변경하지 못했습니다.") : "",
    toggle: () => {
      if (!mutation.isPending)
        mutation.mutate({ sourceId: source.openSourceId, saved: !source.isSaved });
    },
  };
}

/** The save button state and action of `useSourceSave`. */
export type SourceSaveState = {
  saved: boolean;
  busy: boolean;
  error: string;
  toggle: () => void;
};

function SaveButton({ save }: { save: SourceSaveState }) {
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
        <button
          className={sourceStyles.osAuthor}
          onClick={() => onOpen(source.openSourceId)}
          aria-label={`${source.title} 보기`}
        >
          <AlbumArtwork
            src={source.thumbnailUrl}
            title={source.title}
            seed={`source:${source.openSourceId}`}
            className="size-11 shrink-0 rounded-[8px]"
          />
          <span className="min-w-0 flex-1">
            <strong className="truncate">{source.title}</strong>
            {source.instrument && <small>악기: {partLabel(source.instrument)}</small>}
            {source.usageCount != null && <small>{sourceUsage(source.usageCount)}</small>}
          </span>
        </button>
        <SaveButton save={save} />
      </div>
      {save.error && (
        <p role="alert" className="text-body leading-[20px] text-[#ff8d8d]">
          {save.error}
        </p>
      )}
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
        <button
          type="button"
          className={cn(sourceStyles.osFootAuthor, "min-w-0")}
          aria-label={`${source.writer.nickname} 프로필`}
          onClick={() => onProfile(source.writer.userId)}
        >
          <Avatar size="xs" src={source.writer.profileImageUrl} />
          <span className="truncate font-medium">{source.writer.nickname}</span>
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

/**
 * Paged public source list for a keyword; following pages are appended until the server reports no
 * more. A failure with no cards is `error` (retry resets the list); once cards are shown it is
 * `pageError` and the cards stay, `more` retrying the failed load.
 */
export function useOpenSourceList(keyword: string, enabled: boolean) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const options = openSourceListQuery(userId, keyword.trim());
  const query = useInfiniteQuery({ ...options, enabled: enabled && userId !== null });
  const { data, error, isFetching, isFetchNextPageError, hasNextPage, fetchNextPage, refetch } =
    query;
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => {
        if (seen.has(item.openSourceId)) return false;
        seen.add(item.openSourceId);
        return true;
      });
  }, [data]);
  const failure = error ? sourceError(error) : undefined;
  const state =
    data || (error && !isFetching)
      ? {
          items,
          hasNext: hasNextPage,
          error: items.length ? undefined : failure,
          pageError: items.length ? failure : undefined,
        }
      : null;
  return {
    state,
    firstPage: data?.pages[0]?.items,
    userId,
    /** Loads the next page, or retries the failed load; never interrupts a running fetch (refresh). */
    more: () => {
      if (isFetching) return;
      if (error && !isFetchNextPageError) void refetch();
      else if (hasNextPage) void fetchNextPage({ cancelRefetch: false });
    },
    moreBusy: isFetching,
    retry: () => void queryClient.resetQueries({ queryKey: options.queryKey, exact: true }),
    signedIn: userId !== null,
  };
}

function recommendSources(items: OpenSourceSummary[], viewerId: number | null) {
  const others = items.filter((item) => item.writer.userId !== viewerId);
  const authors = new Set<number>();
  const first: OpenSourceSummary[] = [];
  const rest: OpenSourceSummary[] = [];
  for (const item of others.length ? others : items) {
    const authorId = item.writer.userId;
    if (authors.has(authorId)) {
      rest.push(item);
    } else {
      authors.add(authorId);
      first.push(item);
    }
  }
  return [...first, ...rest].slice(0, sourceDiscoverySize);
}

/**
 * The 탐색 tab's data (OpensourceScreen and the app's native screen): the public list, the popular
 * section's query and the recommended section (from the list's first page; undefined until loaded).
 */
export function useOpensourceFeed() {
  const list = useOpenSourceList("", true);
  const popular = useQuery({ ...popularOpenSourcesQuery(list.userId), enabled: list.signedIn });
  const popularItems = popular.data?.items;
  const recommended = list.firstPage && recommendSources(list.firstPage, list.userId);
  return { list, popular, popularItems, recommended };
}

function discoveryCardStep(track: HTMLDivElement) {
  const first = track.children[0];
  const second = track.children[1];
  if (first instanceof HTMLElement && second instanceof HTMLElement) {
    const delta = second.offsetLeft - first.offsetLeft;
    if (delta > 0) return delta;
  }
  return track.clientWidth;
}

function SourceDiscoverySection({
  title,
  items,
  error,
  retry,
  emptyMessage = "표시할 샘플이 없습니다.",
  hasNext = false,
  moreBusy = false,
  moreError,
  onMore,
  onOpen,
  onProfile,
}: {
  title: string;
  items?: OpenSourceSummary[];
  error?: string;
  retry: () => void;
  emptyMessage?: string;
  hasNext?: boolean;
  moreBusy?: boolean;
  /** A failed load after cards are shown: the end tile offers "다시 시도" (`onMore`) instead. */
  moreError?: string;
  onMore?: () => void;
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    left: number;
    scale: number;
    startTime: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const count = items?.length ?? 0;
  const moreTile = Boolean(onMore && (hasNext || moreError));
  const paged = count > 1 || moreTile;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (!paged || event.pointerType !== "mouse" || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("input")) return;
    const track = event.currentTarget;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: track.scrollLeft,
      scale: track.getBoundingClientRect().width / track.clientWidth || 1,
      startTime: performance.now(),
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
    const distance = (start.x - event.clientX) / start.scale;
    const elapsed = Math.max(1, performance.now() - start.startTime);
    const velocity = Math.abs(distance) / elapsed;
    let target: number;
    if (
      event.type === "pointerup" &&
      ((velocity >= 0.35 && Math.abs(distance) >= 18) || Math.abs(distance) >= 36)
    ) {
      target = initial + Math.sign(distance);
    } else {
      target = Math.round(track.scrollLeft / step);
    }
    const maxIndex = Math.max(0, track.children.length - 1);
    const next = Math.max(
      Math.max(0, initial - 1),
      Math.min(Math.min(maxIndex, initial + 1), target),
    );
    delete track.dataset.dragging;
    // No explicit behavior: the rail's `motion-safe:scroll-smooth` decides, honoring reduced motion.
    track.scrollTo({ left: next * step });
  }

  return (
    <section aria-label={title}>
      <SectionTitle className="mb-0! px-0">{title}</SectionTitle>
      {!items &&
        (error ? (
          <div
            role="alert"
            className="rounded-[10px] bg-app-panel p-4 text-body leading-[20px] text-[#ff8d8d]"
          >
            <p className="mb-3">{error}</p>
            <button
              className={buttonVariants({ tone: "secondary", size: "compact" })}
              onClick={retry}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <p role="status" className="px-1 py-2 text-body leading-[20px] text-app-muted">
            샘플을 불러오는 중...
          </p>
        ))}
      {items?.length === 0 && <p className={sourceStyles.osDiscoveryEmpty}>{emptyMessage}</p>}
      {!!items?.length && (
        <div
          ref={rail}
          className={sourceStyles.osDiscoveryRail}
          data-paged={paged}
          onScroll={(event) => {
            if (!hasNext || moreBusy || moreError || !onMore) return;
            const track = event.currentTarget;
            const step = discoveryCardStep(track);
            if (track.scrollLeft + track.clientWidth >= track.scrollWidth - step * 1.5) {
              onMore();
            }
          }}
          onPointerDown={startDrag}
          onPointerMove={updateDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onPointerLeave={(event) => {
            if (drag.current?.pointerId === event.pointerId && !drag.current.active)
              drag.current = null;
          }}
          onClickCapture={(event) => {
            if (!suppressClick.current || event.detail === 0) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {items.map((source) => (
            <OpenSourceCard
              key={source.openSourceId}
              source={source}
              onOpen={onOpen}
              onProfile={onProfile}
            />
          ))}
          {moreTile &&
            (moreError && !moreBusy ? (
              <div
                role="alert"
                className="flex w-[168px] flex-none snap-start flex-col items-center justify-center gap-3 rounded-[12px] border border-solid border-app-border bg-app-panel p-4 text-center text-body leading-[20px] text-[#ff8d8d]"
              >
                <p className="m-0">{moreError}</p>
                <button
                  type="button"
                  className={buttonVariants({ tone: "secondary", size: "compact" })}
                  onClick={onMore}
                >
                  다시 시도
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-[124px] flex-none snap-start items-center justify-center rounded-[12px] border border-solid border-app-border bg-app-panel px-4 text-body font-medium text-app-muted transition-colors hover:text-app-fg disabled:opacity-50"
                disabled={moreBusy}
                onClick={onMore}
              >
                {moreBusy ? "불러오는 중..." : "더보기"}
              </button>
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
  const { list, popular, popularItems, recommended } = useOpensourceFeed();
  if (!list.signedIn) return <SignInRequired>샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  const { state } = list;
  return (
    <div
      className={cn(
        sourceStyles.opensourceView,
        sharedStyles.scrollContent,
        sourceStyles.osDiscoverySections,
      )}
    >
      <SourceDiscoverySection
        title="인기 샘플"
        items={popularItems}
        error={popular.error ? sourceError(popular.error) : undefined}
        retry={() => void popular.refetch()}
        onOpen={onOpen}
        onProfile={onProfile}
      />
      <SourceDiscoverySection
        title="추천 샘플"
        items={recommended}
        error={state?.error}
        retry={list.retry}
        onOpen={onOpen}
        onProfile={onProfile}
      />
      <SourceDiscoverySection
        title="전체 샘플"
        items={state?.error ? undefined : state?.items}
        error={state?.error}
        retry={list.retry}
        emptyMessage="아직 공개된 샘플이 없습니다."
        hasNext={state?.hasNext}
        moreBusy={list.moreBusy}
        moreError={state?.pageError}
        onMore={() => void list.more()}
        onOpen={onOpen}
        onProfile={onProfile}
      />
    </div>
  );
}

/**
 * The sample page's state (OpensourceDetailScreen and the app's native screen): the sample query, its
 * comments (`useComments`, read once the sample is shown), save, reaction, share and their notice, and
 * `focus` — a counter that moves when the comment input should take focus (it starts at 1 for the
 * /comments address).
 */
export function useSourceDetail(sourceId: number, focusComments: boolean) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const query = useQuery({ ...openSourceQuery(userId, sourceId), enabled: userId !== null });
  const source = query.data;
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
      update: updateOpenSourceComment,
      remove: deleteOpenSourceComment,
      react: reactToOpenSourceComment,
      report: reportOpenSourceComment,
      hide: hideOpenSourceComment,
    }),
    [sourceId],
  );
  const comments = useComments({
    adapter,
    currentUserId: userId,
    // The comments are read once the sample is shown, as the web list mounts with it.
    canRead: userId !== null && source !== undefined,
    // The detail's comment count is server-owned: reread it after a comment is added or removed.
    onChanged: refreshSource,
  });
  const save = useSourceSave({ openSourceId: sourceId, isSaved: source?.isSaved ?? false });
  const sharing = useShareLink();
  const reaction = useMutation({
    mutationFn: (kind: "like" | "dislike") => reactToOpenSource(sourceId, kind),
    onSuccess: (result) => {
      patchSource(queryClient, userId, sourceId, result);
      void queryClient.invalidateQueries({ queryKey: sourceKeys.popular(userId) });
    },
  });
  const [notice, setNotice] = useState("");
  function vote(kind: "like" | "dislike") {
    if (reaction.isPending) return;
    setNotice("");
    reaction.mutate(kind, {
      onError: (cause) => setNotice(sourceError(cause, "반응을 반영하지 못했습니다.")),
    });
  }
  async function share(title: string) {
    setNotice("");
    try {
      const { shareUrl } = await getOpenSourceShare(sourceId);
      const link = canonicalShareLink("source", sourceId, shareUrl, publicWebOrigin());
      setNotice((await sharing.share(title, link)) ?? "");
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
  return {
    userId,
    query,
    source,
    /** "샘플을 불러오는 중..." while true and no sample is shown; otherwise the load error. */
    loading: !source && (!query.error || query.isFetching),
    error: sourceError(query.error),
    retry: () => void query.refetch(),
    comments,
    focus,
    focusComments: () => setFocus((value) => value + 1),
    save,
    busy: reaction.isPending || save.busy,
    vote,
    share: () => {
      if (source) void share(source.title);
    },
    notice,
    shareDialog: sharing.dialog,
  };
}

/** The state and actions of `useSourceDetail`. */
export type SourceDetailState = {
  userId: number | null;
  query: UseQueryResult<OpenSourceDetail, Error>;
  source: OpenSourceDetail | undefined;
  loading: boolean;
  error: string;
  retry: () => void;
  comments: CommentsState;
  focus: number;
  focusComments: () => void;
  save: SourceSaveState;
  busy: boolean;
  vote: (kind: "like" | "dislike") => void;
  share: () => void;
  notice: string;
  shareDialog: ReactNode;
};

function SourceDetail({
  source,
  detail,
  onProfile,
}: {
  source: OpenSourceDetail;
  detail: SourceDetailState;
  onProfile: (id: number) => void;
}) {
  const { save, notice } = detail;
  const [reporting, setReporting] = useState(false);
  const canReport = detail.userId !== null && detail.userId !== source.writer.userId;
  return (
    <div className={sourceStyles.opensourceDetail}>
      {detail.shareDialog}
      {reporting && canReport && (
        <FigmaSheet title="신고" onClose={() => setReporting(false)}>
          <ReportReasons
            onSubmit={(reason, description) =>
              reportOpenSource(source.openSourceId, reason, description)
            }
            onDone={() => setReporting(false)}
          />
        </FigmaSheet>
      )}
      <section className={sourceStyles.osDetailArticle}>
        <div className={sourceStyles.osDetailTitleRow}>
          <div className={sourceStyles.osDetailTitle}>
            <AlbumArtwork
              src={source.thumbnailUrl}
              title={source.title}
              seed={`source:${source.openSourceId}`}
              className="size-11 shrink-0 rounded-[8px]"
            />
            <span className="min-w-0 flex-1">
              <strong className="break-words">{source.title}</strong>
              {source.instrument && <small>악기: {partLabel(source.instrument)}</small>}
            {source.usageCount != null && <small>{sourceUsage(source.usageCount)}</small>}
            </span>
          </div>
          <SaveButton save={save} />
        </div>
        {save.error && (
          <p role="alert" className="mt-2 text-body leading-[20px] text-[#ff8d8d]">
            {save.error}
          </p>
        )}
        <button
          type="button"
          className={sourceStyles.osDetailByline}
          aria-label={`${source.writer.nickname} 프로필`}
          onClick={() => onProfile(source.writer.userId)}
        >
          <Avatar size="xs" src={source.writer.profileImageUrl} />
          <span className="truncate font-medium">{source.writer.nickname}</span>
        </button>
        <p className={sourceStyles.osDetailCopy}>{source.description ?? ""}</p>
        <SourcePlayback
          sourceId={source.openSourceId}
          canPreview={source.canPreview}
          durationMs={source.durationMs}
        />
        <p className={cn(sourceStyles.osDiscoveryEmpty, "my-3!")}>
          보관한 뒤 스튜디오의 ‘+ 샘플’에서 레이어에 추가할 수 있습니다. MIDI 샘플은 피아노롤에서도 음표로 불러올 수 있습니다.
        </p>
        <PostActions
          likeCount={source.likeCount}
          dislikeCount={source.dislikeCount}
          commentCount={source.commentCount}
          vote={source.isLiked ? "like" : source.isDisliked ? "dislike" : null}
          onVote={detail.vote}
          busy={detail.busy}
          onComments={detail.focusComments}
          saved={save.saved}
          onSave={save.toggle}
          onShare={detail.share}
          onReport={canReport ? () => setReporting(true) : undefined}
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
  onBack,
  onSearch,
}: {
  sourceId: number;
  focusComments: boolean;
  onProfile: (id: number) => void;
  /** Header buttons of the app's native screen. */
  onBack: () => void;
  onSearch: () => void;
}) {
  const detail = useSourceDetail(sourceId, focusComments);
  return (
    <>
      {nativeApp() ? (
        <>
          {detail.shareDialog}
          <NativeSourceDetailBridge
            detail={detail}
            focusComments={focusComments}
            onProfile={onProfile}
            onBack={onBack}
            onSearch={onSearch}
          />
        </>
      ) : (
        <SourceDetailView detail={detail} onProfile={onProfile} />
      )}
    </>
  );
}

function SourceDetailView({
  detail,
  onProfile,
}: {
  detail: SourceDetailState;
  onProfile: (id: number) => void;
}) {
  const { source } = detail;
  if (detail.userId === null)
    return <SignInRequired>샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  if (detail.loading) return <PageState>샘플을 불러오는 중...</PageState>;
  if (!source)
    return (
      <PageState error>
        <span className="grid gap-3">
          <span>{detail.error}</span>
          <button
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            onClick={detail.retry}
          >
            다시 시도
          </button>
        </span>
      </PageState>
    );
  return (
    <div className={sourceStyles.opensourceDetailShell}>
      <CommentsView
        comments={detail.comments}
        onProfile={onProfile}
        focus={detail.focus}
        header={<SourceDetail source={source} detail={detail} onProfile={onProfile} />}
      />
    </div>
  );
}

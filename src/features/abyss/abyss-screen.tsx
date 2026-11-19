import { useSearchParams } from "react-router";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { abyssStyles } from "@/styles/abyss.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectMetadataEditor } from "@/features/composition/project-metadata-editor";
import { AlbumCarousel } from "@/features/abyss/album-carousel";
import { ShortParticipants } from "@/features/abyss/short-participants";
import { findNextFeedShort } from "./next-feed-short";
import { AbyssComments } from "./abyss-comments";
import { NativeAbyssBridge } from "./native-abyss-bridge";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { Asset } from "@/components/asset";
import { PostActions } from "@/features/posts/post-actions";
import { canonicalShareLink } from "@/lib/api/content-link";
import { publicWebOrigin } from "@/lib/public-web-origin";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { useShareLink } from "@/hooks/use-share-link";
import { ApiError } from "@/lib/api/client";
import {
  participationLabel,
  shortParticipation,
  type ShortParticipation,
} from "@/features/abyss/short-participation";
import { contributionsQuery } from "@/features/workspace/workspace-queries";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useShortPlayback, type ShortPlayback } from "@/features/abyss/use-short-playback";
import {
  shortDetailQuery,
  shortsFeedQuery,
  updateCachedShort,
} from "@/features/abyss/abyss-queries";
import {
  getShort,
  getShortShareLink,
  getShorts,
  reactToShort,
  recordShortView,
  toggleShortBookmark,
} from "@/lib/api/shorts";
import { reportShort } from "@/lib/api/reports";
import type { ShortItemDto } from "@/lib/api/contracts";
import { queryScope } from "@/lib/query";

function actionError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) return "로그인 후 이용할 수 있습니다.";
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof DOMException) return "링크를 복사하지 못했습니다.";
  if (cause instanceof TypeError) return "요청을 처리하지 못했습니다. 네트워크를 확인해주세요.";
  return cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
}

export type AbyssOptions = {
  onRememberShort?: (id: number) => void;
  onProfile: (userId: number) => void;
  onJoin: (shortId: number) => void;
  onOpenStudio: (projectId: number) => void;
  /** `contributionId` is null when the pending request could not be found; the page falls back to the sent list. */
  onOpenRequest: (projectId: number, contributionId: number | null) => void;
  initialShortId?: number | null;
  muted?: boolean;
};

type CoverCycle = { key: number; previous: ShortItemDto; direction: "next" | "previous" };

export type AbyssState = {
  status: "error" | "loading" | "empty" | "ready";
  /** "다시 시도" of the load error. */
  retry: () => void;
  currentUserId: number | null;
  shorts: ShortItemDto[];
  index: number;
  /** The listened short; undefined unless `status` is ready. */
  selectedShort: ShortItemDto | undefined;
  /** A wrap-around move: the carousel shows the previous cover next to the new one. */
  coverCycle: CoverCycle | null;
  sheet: "participants" | "comments" | "report" | null;
  openParticipants: () => void;
  /** Every close path of the participant sheet: applies its selection. */
  closeParticipants: () => void;
  listenAll: () => void;
  openComments: () => void;
  openReport: () => void;
  closeSheet: () => void;
  submitReport: (reason: string, description: string | null) => Promise<unknown>;
  feedback: string | null;
  shareDialog: ReactNode;
  muted: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  mediaUrl: string | null;
  mediaFailed: boolean;
  /** The `<audio>` failed to load the current short's file. */
  mediaError: () => void;
  playback: ShortPlayback;
  nextFailed: boolean;
  loadingMore: boolean;
  advancing: boolean;
  hasNext: boolean;
  selectPrevious: () => void;
  selectNext: () => Promise<void>;
  openProfile: (userId: number) => void;
  participation: ShortParticipation | null;
  requestBusy: boolean;
  /** The participation button: join, the pending request, or the studio. */
  join: () => void;
  /** A reaction, save or share is being sent. */
  busy: boolean;
  vote: (kind: "like" | "dislike") => void;
  bookmark: () => void;
  share: () => void;
  /** After a comment write: re-reads the short's comment count. */
  commentsChanged: () => void;
};

/** The abyss feed, the selected short and its actions; drawn by the web AbyssScreen and the app's abyss screen. */
export function useAbyss({
  onProfile,
  onJoin,
  onOpenStudio,
  onOpenRequest,
  initialShortId,
  muted = false,
  onRememberShort,
}: AbyssOptions): AbyssState {
  const { requireLogin } = useLoginPrompt();
  const currentUserId = useCurrentUserId();
  const queryClient = useQueryClient();
  const sharing = useShareLink();
  const [notificationQuery] = useSearchParams();
  const commentLink = notificationQuery.get("commentId");
  const [sheet, setSheet] = useState<"participants" | "comments" | "report" | null>(
    commentLink ? "comments" : null,
  );
  const [openedCommentLink, setOpenedCommentLink] = useState(commentLink);
  if (openedCommentLink !== commentLink) {
    setOpenedCommentLink(commentLink);
    if (commentLink) setSheet("comments");
  }
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nextFailed, setNextFailed] = useState(false);
  const [mediaFailedShortId, setMediaFailedShortId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const advancingRef = useRef(false);
  const restartPlaybackRef = useRef<() => void>(() => {});
  const [advancing, setAdvancing] = useState(false);
  const [coverCycle, setCoverCycle] = useState<CoverCycle | null>(null);
  // The selection is tracked by ID, so loaded pages and a prepended deep link never move the listener.
  const [selectedId, setSelectedId] = useState(initialShortId ?? null);

  // The feed (with its cursor) loads once per account. A shared/saved deep link outside the first page is read
  // directly and prepended instead of scanning the feed for it; an account change re-reads the URL's short.
  const [link, setLink] = useState({ userId: currentUserId, shortId: initialShortId ?? null });
  if (link.userId !== currentUserId)
    setLink({ userId: currentUserId, shortId: initialShortId ?? null });
  const feed = useInfiniteQuery(shortsFeedQuery(currentUserId));
  const firstPage = feed.data?.pages[0];
  const needsLinked =
    link.shortId !== null &&
    firstPage !== undefined &&
    !firstPage.items.some((item) => item.shortId === link.shortId);
  const linked = useQuery({
    ...shortDetailQuery(currentUserId, link.shortId ?? 0),
    enabled: needsLinked,
  });
  const linkedFailed =
    needsLinked &&
    !linked.data &&
    linked.isError &&
    !(linked.error instanceof ApiError && linked.error.status === 404);

  // A deep-linked short is prepended to the first page, so its own page must not add it twice: the URL sync
  // would jump back to the first copy and loop the feed.
  const shorts: ShortItemDto[] = [];
  const loadedIds = new Set<number>();
  const feedItems = feed.data?.pages.flatMap((page) => page.items) ?? [];
  for (const item of needsLinked && linked.data ? [linked.data, ...feedItems] : feedItems) {
    if (loadedIds.has(item.shortId)) continue;
    loadedIds.add(item.shortId);
    shorts.push(item);
  }
  const index = initialShortIndex(shorts, selectedId);

  // Selecting a short rewrites the URL to it; only a URL change to a short that is not loaded needs a direct read.
  const [seenLinkedId, setSeenLinkedId] = useState(initialShortId);
  if (initialShortId !== seenLinkedId) {
    setSeenLinkedId(initialShortId);
    if (initialShortId != null) {
      setSelectedId(initialShortId);
      if (!loadedIds.has(initialShortId))
        setLink({ userId: currentUserId, shortId: initialShortId });
    }
  }

  const currentShortId = shorts[index]?.shortId;
  useEffect(() => {
    if (currentShortId === undefined) return;
    // View counting is best-effort and never blocks listening.
    void recordShortView(currentShortId).catch(() => {});
  }, [currentShortId]);

  const current: ShortItemDto | undefined = shorts[index];
  const openProfile = (userId: number) => {
    if (current) onRememberShort?.(current.shortId);
    onProfile(userId);
  };
  const participation = current ? shortParticipation(current, currentUserId) : null;
  const requestContext = useRef<AbortController | null>(null);
  const [openingRequest, setOpeningRequest] = useState<{
    shortId: number | undefined;
    userId: number | null;
    signal: AbortSignal;
  } | null>(null);
  useLayoutEffect(() => {
    const context = new AbortController();
    requestContext.current = context;
    // A late response must not navigate after leaving this song or switching accounts.
    return () => context.abort();
  }, [currentShortId, currentUserId]);
  const requestBusy =
    openingRequest !== null &&
    openingRequest.shortId === currentShortId &&
    openingRequest.userId === currentUserId &&
    !openingRequest.signal.aborted;
  // The short only says a request is pending; its ID comes from the project's contribution list.
  async function openPendingRequest(projectId: number) {
    const signal = requestContext.current?.signal;
    if (!signal || signal.aborted) return;
    setOpeningRequest({ shortId: currentShortId, userId: currentUserId, signal });
    try {
      const list = await queryClient.fetchQuery({
        ...contributionsQuery(currentUserId, projectId),
        staleTime: 0,
      });
      if (signal.aborted) return;
      const pending = list.find(
        (item) => item.userId === currentUserId && item.approvalStatus === "PENDING",
      );
      onOpenRequest(projectId, pending?.contributionId ?? null);
    } catch {
      if (!signal.aborted) onOpenRequest(projectId, null);
    } finally {
      if (!signal.aborted)
        setOpeningRequest((request) => (request?.signal === signal ? null : request));
    }
  }
  function join() {
    const projectId = current?.projectId;
    if (!current || !participation || projectId == null) return;
    if (participation === "joinable") onJoin(current.shortId);
    else if (participation === "pending") void openPendingRequest(projectId);
    else onOpenStudio(projectId);
  }
  const mediaUrl = current?.mediaUrl?.trim() || null;
  const loadingMore = feed.isFetchingNextPage || advancing;
  // The feed never ends: after the last short the list is read again from the backend.
  const hasNext = shorts.length > 0;
  const playback = useShortPlayback({ short: current ?? null, audioRef, muted });
  useLayoutEffect(() => {
    restartPlaybackRef.current = playback.restart;
  });

  function select(short: ShortItemDto) {
    audioRef.current?.pause();
    setFeedback(null);
    setSheet(null);
    setSelectedId(short.shortId);
    onRememberShort?.(short.shortId);
  }

  function selectShort(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= shorts.length) return;
    setNextFailed(false);
    select(shorts[nextIndex]);
  }

  function selectPrevious() {
    if (index > 0) {
      selectShort(index - 1);
    } else if (current && shorts.length > 1) {
      setCoverCycle((cycle) => ({
        key: (cycle?.key ?? 0) + 1,
        previous: current,
        direction: "previous",
      }));
      selectShort(shorts.length - 1);
    }
  }

  async function selectNext() {
    if (index < shorts.length - 1) {
      selectShort(index + 1);
      return;
    }
    const signal = requestContext.current?.signal;
    if (!signal || signal.aborted || feed.isFetchingNextPage || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    setNextFailed(false);
    try {
      const result = await findNextFeedShort(
        feed,
        () => feed.fetchNextPage({ cancelRefetch: false }),
        loadedIds,
        signal,
      );
      if (signal.aborted) return;
      if (result.kind === "found") select(result.short);
      if (result.kind === "failed") setNextFailed(true);
      if (result.kind === "end") await restartFeed(signal);
    } catch {
      if (!signal.aborted) setNextFailed(true);
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  }

  // Keep the current short selected until the refreshed first page arrives.
  async function restartFeed(signal: AbortSignal) {
    const first = await getShorts(undefined, signal);
    if (signal.aborted) return;
    const requestedFrom = current?.shortId;
    const next = first.items[0];
    if (!next) return;
    if (current && next.shortId !== requestedFrom) {
      setCoverCycle((cycle) => ({
        key: (cycle?.key ?? 0) + 1,
        previous: current,
        direction: "next",
      }));
    }
    queryClient.setQueryData(shortsFeedQuery(currentUserId).queryKey, {
      pages: [first],
      pageParams: [undefined],
    });
    // The fresh list starts the cycle again; a deep-linked short is no longer prepended to it.
    setLink({ userId: currentUserId, shortId: null });
    if (next.shortId === requestedFrom) restartPlaybackRef.current();
    else select(next);
  }

  // Confirm, backdrop, grip and Escape all apply the sheet's selection the same way.
  const closeParticipants = () => {
    playback.applyDraft();
    setSheet(null);
  };

  const showError = (cause: unknown) => setFeedback(actionError(cause));
  const reaction = useMutation({
    mutationFn: async ({ shortId, kind }: { shortId: number; kind: "like" | "dislike" }) => {
      await reactToShort(shortId, kind);
      // The reaction response has only the requested side; the detail has both.
      return getShort(shortId);
    },
    onSuccess: (short) => updateCachedShort(queryClient, currentUserId, short.shortId, () => short),
    onError: showError,
  });
  const bookmarkToggle = useMutation({
    mutationFn: toggleShortBookmark,
    onSuccess: async ({ shortId, isBookmarked }) => {
      await updateCachedShort(queryClient, currentUserId, shortId, (short) => ({
        ...short,
        isBookmarked,
      }));
      void queryClient.invalidateQueries({ queryKey: [...queryScope(currentUserId), "saved"] });
    },
    onError: showError,
  });
  const shareLink = useMutation({
    mutationFn: async (short: ShortItemDto) => {
      const { shareUrl } = await getShortShareLink(short.shortId);
      return sharing.share(
        short.title,
        canonicalShareLink("short", short.shortId, shareUrl, publicWebOrigin()),
      );
    },
    onSuccess: setFeedback,
    onError: showError,
  });
  const report = useMutation({
    mutationFn: ({
      shortId,
      reason,
      description,
    }: {
      shortId: number;
      reason: string;
      description: string | null;
    }) => reportShort(shortId, reason, description),
  });
  const busy = reaction.isPending || bookmarkToggle.isPending || shareLink.isPending;
  const vote = (kind: "like" | "dislike") => {
    if (!current || busy || !requireLogin()) return;
    setFeedback(null);
    reaction.mutate({ shortId: current.shortId, kind });
  };
  const bookmark = () => {
    if (!current || busy || !requireLogin()) return;
    setFeedback(null);
    bookmarkToggle.mutate(current.shortId);
  };
  const share = () => {
    if (!current || busy || !requireLogin()) return;
    setFeedback(null);
    shareLink.mutate(current);
  };
  // The comment count lives on the short; re-read it from the server.
  const commentsChanged = () => {
    if (!current) return;
    const shortId = current.shortId;
    void queryClient
      .fetchQuery({ ...shortDetailQuery(currentUserId, shortId), staleTime: 0 })
      .then((short) => updateCachedShort(queryClient, currentUserId, shortId, () => short))
      .catch(() => {});
  };

  const status: "error" | "loading" | "empty" | "ready" =
    (!feed.data && feed.isError) || linkedFailed
      ? "error"
      : !feed.data || (needsLinked && linked.isPending)
        ? "loading"
        : !current
          ? "empty"
          : "ready";

  return {
    status,
    retry: () => {
      if (!feed.data) void feed.refetch();
      if (linkedFailed) void linked.refetch();
    },
    currentUserId,
    shorts,
    index,
    selectedShort: current,
    coverCycle,
    sheet,
    openParticipants: () => {
      playback.openSelection();
      setSheet("participants");
    },
    closeParticipants,
    listenAll: () => {
      playback.listenAll();
      setSheet(null);
    },
    openComments: () => setSheet("comments"),
    openReport: () => {
      if (requireLogin()) setSheet("report");
    },
    closeSheet: () => setSheet(null),
    submitReport: (reason: string, description: string | null) =>
      current
        ? report.mutateAsync({ shortId: current.shortId, reason, description })
        : Promise.resolve(),
    feedback,
    shareDialog: sharing.dialog,
    audioRef,
    mediaUrl,
    mediaFailed: current !== undefined && mediaFailedShortId === current.shortId,
    mediaError: () => {
      if (current && mediaUrl) setMediaFailedShortId(current.shortId);
    },
    playback,
    nextFailed,
    loadingMore,
    advancing,
    hasNext,
    selectPrevious,
    selectNext,
    openProfile,
    participation,
    requestBusy,
    join,
    busy,
    vote,
    bookmark,
    share,
    commentsChanged,
    muted,
  };
}

export function AbyssScreen({
  nativeScreen,
  ...options
}: AbyssOptions & {
  /**
   * In the app: the page's header search and footer controller. As on the web, an open comment or
   * participant sheet covers the footer, so the footer leaves the screen meanwhile.
   */
  nativeScreen?: { onSearch: () => void; footer: ReactNode };
}) {
  const abyss = useAbyss(options);
  return nativeScreen ? (
    <NativeAbyssContent abyss={abyss} nativeScreen={nativeScreen} />
  ) : (
    <AbyssView abyss={abyss} />
  );
}

/** Nonvisual media transport and native controllers; never mounts the browser drawing. */
function NativeAbyssContent({
  abyss,
  nativeScreen,
}: {
  abyss: AbyssState;
  nativeScreen: { onSearch: () => void; footer: ReactNode };
}) {
  const {
    selectedShort: current,
    playback,
    mediaUrl,
    audioRef,
    muted,
    mediaError,
    sheet,
    submitReport,
    closeSheet,
    shareDialog,
  } = abyss;
  return (
    <>
      <NativeAbyssBridge abyss={abyss} onSearch={nativeScreen.onSearch} />
      {sheet !== "comments" && sheet !== "participants" && nativeScreen.footer}
      {current && (
        <audio
          key={current.shortId}
          ref={audioRef}
          src={mediaUrl ?? undefined}
          preload="metadata"
          autoPlay
          muted={muted}
          {...playback.nativeHandlers}
          onError={mediaError}
        />
      )}
      {sheet === "report" && <ReportReasons onSubmit={submitReport} onDone={closeSheet} />}
      {shareDialog}
    </>
  );
}

/** Browser-only drawing of `useAbyss`; app controllers never mount this tree. */
function AbyssView({ abyss }: { abyss: AbyssState }) {
  const { selectedShort: current, playback, sheet, shorts, mediaUrl, audioRef } = abyss;
  const [metadataTarget, setMetadataTarget] = useState<number | null>(null);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const titleViewport = useRef<HTMLHeadingElement>(null);
  const titleText = useRef<HTMLSpanElement>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const progress =
    playback.totalMs > 0 ? Math.min(100, (playback.positionMs / playback.totalMs) * 100) : 0;
  useLayoutEffect(() => {
    const viewport = titleViewport.current;
    const title = titleText.current;
    if (!viewport || !title) return;
    const measure = () => setTitleOverflows(title.offsetWidth > viewport.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(title);
    measure();
    return () => observer.disconnect();
  }, [current?.shortId, current?.title]);

  if (abyss.status === "error") {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="alert">
        <p>숏폼을 불러오지 못했습니다.</p>
        <button onClick={abyss.retry}>다시 시도</button>
      </div>
    );
  }
  if (abyss.status === "loading") {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="status">
        숏폼을 불러오는 중입니다.
      </div>
    );
  }
  if (!current) {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)}>
        아직 공개된 숏폼이 없습니다.
      </div>
    );
  }

  const { participation } = abyss;
  return (
    <div className={abyssStyles.abyssView}>
      {abyss.shareDialog}
      <div className={abyssStyles.abyssSong}>
        <AlbumCarousel
          items={shorts}
          index={abyss.index}
          cycle={abyss.coverCycle}
          onPrevious={abyss.selectPrevious}
          onNext={() => {
            void abyss.selectNext();
          }}
          onToggle={playback.canPlay ? () => void playback.toggle() : undefined}
        />
        <div className={abyssStyles.abyssTitle}>
          <h1 ref={titleViewport} className="overflow-hidden">
            <span
              key={current.shortId}
              className={cn(
                "inline-flex w-max whitespace-nowrap align-top",
                titleOverflows && "abyss-title-marquee",
              )}
            >
              <span ref={titleText}>{current.title}</span>
              {titleOverflows && (
                <span aria-hidden="true" className="pl-8">
                  {current.title}
                </span>
              )}
            </span>
          </h1>
          <p>
            <button onClick={() => abyss.openProfile(current.author.userId)}>
              {current.author.nickname}
            </button>{" "}
            <i /> <button onClick={abyss.openParticipants}>작곡 참여자 보기</button>
          </p>
        </div>
        {metadataTarget === current.shortId &&
          current.projectId != null &&
          current.author.userId === abyss.currentUserId && (
          <FigmaSheet
            title="곡 정보 수정"
            onClose={() => { if (!metadataBusy) setMetadataTarget(null); }}
          >
            <ProjectMetadataEditor
              key={`${abyss.currentUserId}:${current.projectId}`}
              projectId={current.projectId}
              title={current.title}
              albumImageUrl={current.albumImageUrl}
              onBusyChange={setMetadataBusy}
              onClose={() => setMetadataTarget(null)}
            />
          </FigmaSheet>
        )}
        <PostActions
          likeCount={current.likeCount}
          dislikeCount={current.dislikeCount}
          commentCount={current.commentCount}
          vote={current.isLiked ? "like" : current.isDisliked ? "dislike" : null}
          saved={current.isBookmarked}
          busy={abyss.busy}
          onVote={abyss.vote}
          onComments={abyss.openComments}
          onShare={abyss.share}
          onSave={abyss.bookmark}
          onReport={abyss.openReport}
          onEdit={
            current.projectId != null && current.author.userId === abyss.currentUserId
              ? () => {
                  if (playback.playing) void playback.toggle();
                  setMetadataTarget(current.shortId);
                }
              : undefined
          }
        />
      </div>
      <div className={abyssStyles.abyssBottomStack}>
        <div className={abyssStyles.abyssPlayer}>
          <audio
            key={current.shortId}
            ref={audioRef}
            src={mediaUrl ?? undefined}
            preload="metadata"
            autoPlay
            muted={abyss.muted}
            {...playback.nativeHandlers}
            onError={abyss.mediaError}
          />
          <input
            className={abyssStyles.abyssProgress}
            type="range"
            min={0}
            max={playback.totalMs / 1000 || 1}
            step="0.1"
            value={Math.min(playback.positionMs / 1000, playback.totalMs / 1000 || 1)}
            style={{
              background: `linear-gradient(to right, #f2f4f6 ${progress}%, #303030 ${progress}%)`,
            }}
            onChange={(event) => playback.seek(Number(event.target.value) * 1000)}
            aria-label="재생 위치"
            disabled={playback.totalMs === 0}
          />
          <div className={abyssStyles.abyssPlayerControls}>
            <Asset name="abyss-player.svg" />
            <button
              className={abyssStyles.abyssPrevious}
              onClick={abyss.selectPrevious}
              disabled={shorts.length < 2}
              aria-label="이전 숏폼"
            />
            <button
              className={cn(
                abyssStyles.abyssToggle,
                playback.playing ? sharedStyles.isPlaying : "",
              )}
              onClick={() => void playback.toggle()}
              disabled={!playback.canPlay}
              aria-label={playback.playing ? "일시정지" : "재생"}
            />
            <button
              className={abyssStyles.abyssNext}
              onClick={() => void abyss.selectNext()}
              disabled={!abyss.hasNext || abyss.loadingMore}
              aria-label="다음 숏폼"
            />
          </div>
          {playback.selection !== null && (
            <p className={abyssStyles.abyssPlaybackMessage} role="status">
              {playback.selection.size === 0
                ? "선택한 참여자가 없어 재생을 멈췄습니다."
                : `선택한 참여자 ${playback.selection.size}명의 트랙만 재생합니다.`}
            </p>
          )}
          {playback.selection === null && !mediaUrl && (
            <p className={abyssStyles.abyssPlaybackMessage}>재생 가능한 음원 파일이 없습니다.</p>
          )}
          {playback.selection === null && abyss.mediaFailed && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              음원 파일을 불러오지 못했습니다.
            </p>
          )}
          {playback.error && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              {playback.error}
            </p>
          )}
          {abyss.nextFailed && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              다음 숏폼을 불러오지 못했습니다.
              <button
                className={abyssStyles.abyssPlaybackRetry}
                disabled={abyss.loadingMore}
                onClick={() => void abyss.selectNext()}
              >
                다시 시도
              </button>
            </p>
          )}
        </div>
        {sheet === "report" && (
          <FigmaSheet title="신고" onClose={abyss.closeSheet}>
            <ReportReasons onSubmit={abyss.submitReport} onDone={abyss.closeSheet} />
          </FigmaSheet>
        )}
        {abyss.feedback && (
          <p className={abyssStyles.abyssFeedback} role="status">
            {abyss.feedback}
          </p>
        )}
        {sheet === "participants" && (
          <FigmaSheet title="작곡 참여자" onClose={abyss.closeParticipants}>
            <ShortParticipants
              short={current}
              playback={playback}
              onClose={abyss.closeParticipants}
              onListenAll={abyss.listenAll}
            />
          </FigmaSheet>
        )}
        <AbyssComments
          key={current.shortId}
          shortId={current.shortId}
          onChanged={abyss.commentsChanged}
          open={sheet === "comments"}
          onClose={abyss.closeSheet}
        />
        {participation && current.projectId != null && (
          <div className={abyssStyles.abyssJoinSlot}>
            <button
              className={cn(
                abyssStyles.abyssJoin,
                participation !== "joinable" && abyssStyles.abyssJoined,
              )}
              disabled={abyss.requestBusy}
              onClick={abyss.join}
            >
              {participationLabel[participation]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

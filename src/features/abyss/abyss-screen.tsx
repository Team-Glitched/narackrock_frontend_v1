import { abyssStyles } from "@/styles/abyss.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlbumCarousel } from "@/features/abyss/album-carousel";
import { ShortParticipants } from "@/features/abyss/short-participants";
import { AbyssComments } from "./abyss-comments";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { Asset } from "@/components/asset";
import { IconSlot } from "@/components/icon-slot";
import { canonicalShareLink } from "@/lib/api/content-link";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { useShareLink } from "@/hooks/use-share-link";
import { ApiError } from "@/lib/api/client";
import { canJoinShort } from "@/features/abyss/short-participation";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useShortPlayback } from "@/features/abyss/use-short-playback";
import type { PlaybackMode } from "@/features/abyss/short-playback-state";
import { shortDetailQuery, shortsFeedQuery, updateCachedShort } from "@/features/abyss/abyss-queries";
import { getShort, getShortShareLink, reactToShort, recordShortView, toggleShortBookmark } from "@/lib/api/shorts";
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
export function AbyssScreen({
  onProfile,
  onJoin,
  initialShortId,
  muted = false,
  mode = "repeat",
  onRememberShort,
}: {
  onRememberShort?: (id: number) => void;
  onProfile: (userId: number) => void;
  onJoin: (shortId: number) => void;
  initialShortId?: number | null;
  muted?: boolean;
  mode?: PlaybackMode;
}) {
  const currentUserId = useCurrentUserId();
  const queryClient = useQueryClient();
  const sharing = useShareLink();
  const [sheet, setSheet] = useState<"participants" | "comments" | "report" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nextFailed, setNextFailed] = useState(false);
  const [mediaFailedShortId, setMediaFailedShortId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentShortIdRef = useRef<number | undefined>(undefined);
  // The selection is tracked by ID, so loaded pages and a prepended deep link never move the listener.
  const [selectedId, setSelectedId] = useState(initialShortId ?? null);

  // The feed (with its cursor) loads once per account. A shared/saved deep link outside the first page is read
  // directly and prepended instead of scanning the feed for it; an account change re-reads the URL's short.
  const [link, setLink] = useState({ userId: currentUserId, shortId: initialShortId ?? null });
  if (link.userId !== currentUserId) setLink({ userId: currentUserId, shortId: initialShortId ?? null });
  const feed = useInfiniteQuery(shortsFeedQuery(currentUserId));
  const firstPage = feed.data?.pages[0];
  const needsLinked =
    link.shortId !== null && firstPage !== undefined && !firstPage.items.some((item) => item.shortId === link.shortId);
  const linked = useQuery({ ...shortDetailQuery(currentUserId, link.shortId ?? 0), enabled: needsLinked });
  const linkedFailed =
    needsLinked && !linked.data && linked.isError && !(linked.error instanceof ApiError && linked.error.status === 404);

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
      if (!loadedIds.has(initialShortId)) setLink({ userId: currentUserId, shortId: initialShortId });
    }
  }

  const currentShortId = shorts[index]?.shortId;
  useEffect(() => {
    if (currentShortId === undefined) return;
    // View counting is best-effort and never blocks listening.
    void recordShortView(currentShortId).catch(() => {});
  }, [currentShortId]);

  const current = shorts[index];
  const openProfile = (userId: number) => {
    if (current) onRememberShort?.(current.shortId);
    onProfile(userId);
  };
  const mediaUrl = current?.mediaUrl?.trim() || null;
  const loadingMore = feed.isFetchingNextPage;
  const hasNext = index < shorts.length - 1 || feed.hasNextPage;
  const playback = useShortPlayback({ short: current ?? null, audioRef, muted, mode, onNext: selectNext });
  const progress = playback.totalMs > 0 ? Math.min(100, (playback.positionMs / playback.totalMs) * 100) : 0;
  useLayoutEffect(() => {
    currentShortIdRef.current = current?.shortId;
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

  async function selectNext() {
    if (index < shorts.length - 1) {
      selectShort(index + 1);
      return;
    }
    if (!feed.hasNextPage || feed.isFetchingNextPage) return;

    const requestedFrom = current?.shortId;
    setNextFailed(false);
    // An ended event and a click on the same short share one request.
    const result = await feed.fetchNextPage({ cancelRefetch: false });
    if (result.isFetchNextPageError) {
      setNextFailed(true);
      return;
    }
    const fresh = result.data?.pages.at(-1)?.items.find((item) => !loadedIds.has(item.shortId));
    // Only move on when the listener is still on the short that asked for the next page.
    if (!fresh || currentShortIdRef.current !== requestedFrom) return;
    select(fresh);
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
      await updateCachedShort(queryClient, currentUserId, shortId, (short) => ({ ...short, isBookmarked }));
      void queryClient.invalidateQueries({ queryKey: [...queryScope(currentUserId), "saved"] });
    },
    onError: showError,
  });
  const shareLink = useMutation({
    mutationFn: async (short: ShortItemDto) => {
      const { shareUrl } = await getShortShareLink(short.shortId);
      return sharing.share(short.title, canonicalShareLink("short", short.shortId, shareUrl, window.location.origin));
    },
    onSuccess: setFeedback,
    onError: showError,
  });
  const report = useMutation({
    mutationFn: ({ shortId, reason, description }: { shortId: number; reason: string; description: string | null }) =>
      reportShort(shortId, reason, description),
  });
  const busy = reaction.isPending || bookmarkToggle.isPending || shareLink.isPending;
  const vote = (kind: "like" | "dislike") => {
    if (busy) return;
    setFeedback(null);
    reaction.mutate({ shortId: current.shortId, kind });
  };
  const bookmark = () => {
    if (busy) return;
    setFeedback(null);
    bookmarkToggle.mutate(current.shortId);
  };
  const share = () => {
    if (busy) return;
    setFeedback(null);
    shareLink.mutate(current);
  };

  if ((!feed.data && feed.isError) || linkedFailed) {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="alert">
        <p>숏폼을 불러오지 못했습니다.</p>
        <button
          onClick={() => {
            if (!feed.data) void feed.refetch();
            if (linkedFailed) void linked.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (!feed.data || (needsLinked && linked.isPending)) {
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

  return (
    <div className={abyssStyles.abyssView}>
      {sharing.dialog}
      <div className={abyssStyles.abyssSong}>
        <AlbumCarousel
          items={shorts}
          index={index}
          onPrevious={() => selectShort(index - 1)}
          onNext={() => {
            void selectNext();
          }}
        />
        <div className={abyssStyles.abyssTitle}>
          <h1>{current.title}</h1>
          <p>
            <button onClick={() => openProfile(current.author.userId)}>
              {current.author.nickname}
            </button>{" "}
            <i />{" "}
            <button
              onClick={() => {
                playback.openSelection();
                setSheet("participants");
              }}
            >
              작곡 참여자 보기
            </button>
          </p>
        </div>
      </div>
      <div className={abyssStyles.abyssActions}>
        <div className={abyssStyles.abyssVote}>
          <button
            className={current.isLiked ? sharedStyles.active : ""}
            aria-label={`좋아요 ${current.likeCount}개`}
            aria-pressed={current.isLiked}
            disabled={busy}
            onClick={() => vote("like")}
          >
            <IconSlot
              name={current.isLiked ? "v3-short-like-on.svg" : "v3-short-like-off.svg"}
              kind="short"
            />
            <span className={abyssStyles.abyssLikeCount}>{current.likeCount}</span>
          </button>
          <i />
          <button
            className={abyssStyles.abyssDislike}
            aria-label={`싫어요 ${current.dislikeCount}개`}
            aria-pressed={current.isDisliked}
            disabled={busy}
            onClick={() => vote("dislike")}
          >
            <IconSlot
              name={current.isDisliked ? "v3-short-dislike-on.svg" : "v3-short-dislike-off.svg"}
              kind="short"
            />
          </button>
        </div>
        <button onClick={() => setSheet("comments")} aria-label={`댓글 ${current.commentCount}개`}>
          <IconSlot name="abyss-comment.svg" kind="short" />
          {current.commentCount}
        </button>
        <button
          className={abyssStyles.abyssShare}
          onClick={share}
          aria-label="공유"
        >
          <IconSlot name="abyss-share.svg" kind="short-share" />
        </button>
        <button
          className={sharedStyles.saveControl}
          aria-label="저장"
          aria-pressed={current.isBookmarked}
          disabled={busy}
          onClick={bookmark}
        >
          <IconSlot name={current.isBookmarked ? "save-on.svg" : "save-off.svg"} kind="short-save" />
        </button>
        <button
          className={abyssStyles.abyssReport}
          aria-label="신고"
          onClick={() => setSheet("report")}
        >
          <Asset name="short-report.svg" />
        </button>
      </div>
      <div className={abyssStyles.abyssBottomStack}>
        <div className={abyssStyles.abyssPlayer}>
          <audio
            key={current.shortId}
            ref={audioRef}
            src={mediaUrl ?? undefined}
            preload="metadata"
            autoPlay
            muted={muted}
            {...playback.nativeHandlers}
            onError={() => {
              if (mediaUrl) setMediaFailedShortId(current.shortId);
            }}
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
              onClick={() => selectShort(index - 1)}
              disabled={index === 0}
              aria-label="이전 숏폼"
            />
            <button
              className={cn(abyssStyles.abyssToggle, playback.playing ? sharedStyles.isPlaying : "")}
              onClick={() => void playback.toggle()}
              disabled={!playback.canPlay}
              aria-label={playback.playing ? "일시정지" : "재생"}
            />
            <button
              className={abyssStyles.abyssNext}
              onClick={() => void selectNext()}
              disabled={!hasNext || loadingMore}
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
          {playback.selection === null && mediaFailedShortId === current.shortId && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              음원 파일을 불러오지 못했습니다.
            </p>
          )}
          {playback.error && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              {playback.error}
            </p>
          )}
          {nextFailed && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              다음 숏폼을 불러오지 못했습니다.
              <button className={abyssStyles.abyssPlaybackRetry} disabled={loadingMore} onClick={() => void selectNext()}>
                다시 시도
              </button>
            </p>
          )}
        </div>
        {sheet === "report" && (
          <FigmaSheet title="신고" onClose={() => setSheet(null)}>
            <ReportReasons
              onSubmit={(reason, description) => report.mutateAsync({ shortId: current.shortId, reason, description })}
              onDone={() => setSheet(null)}
            />
          </FigmaSheet>
        )}
        {feedback && (
          <p className={abyssStyles.abyssFeedback} role="status">
            {feedback}
          </p>
        )}
        {sheet === "participants" && (
          <FigmaSheet title="작곡 참여자" onClose={closeParticipants}>
            <ShortParticipants
              short={current}
              playback={playback}
              onClose={closeParticipants}
              onListenAll={() => {
                playback.listenAll();
                setSheet(null);
              }}
            />
          </FigmaSheet>
        )}
        <AbyssComments
          key={current.shortId}
          shortId={current.shortId}
          onChanged={() => {
            // The comment count lives on the short; re-read it from the server.
            const shortId = current.shortId;
            void queryClient
              .fetchQuery({ ...shortDetailQuery(currentUserId, shortId), staleTime: 0 })
              .then((short) => updateCachedShort(queryClient, currentUserId, shortId, () => short))
              .catch(() => {});
          }}
          open={sheet === "comments"}
          onClose={() => setSheet(null)}
        />
        {current.completionStatus === "IN_PROGRESS" && current.projectId != null && (
          <div className={abyssStyles.abyssJoinSlot}>
            {canJoinShort(current, currentUserId) && (
              <button className={abyssStyles.abyssJoin} onClick={() => onJoin(current.shortId)}>
                작곡 참여하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { abyssStyles } from "@/styles/abyss.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { AlbumCarousel } from "@/features/abyss/album-carousel";
import { ShortParticipants } from "@/features/abyss/short-participants";
import { AbyssComments } from "./abyss-comments";
import { FigmaSheet } from "@/components/ui/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { Asset } from "@/components/ui/asset";
import { IconSlot } from "@/components/ui/icon-slot";
import { canonicalShareLink } from "@/lib/api/content-link";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { useShareLink } from "@/hooks/use-share-link";
import { ApiError } from "@/lib/api/client";
import { canJoinShort } from "@/features/abyss/short-participation";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useShortPlayback } from "@/features/abyss/use-short-playback";
import type { PlaybackMode } from "@/features/abyss/short-playback-state";
import {
  getShort,
  getShortShareLink,
  getShorts,
  reactToShort,
  recordShortView,
  toggleShortBookmark,
} from "@/lib/api/shorts";
import { reportShort } from "@/lib/api/reports";
import type { ShortItemDto, ShortsPageDto } from "@/lib/api/contracts";

type FeedState = "loading" | "ready" | "error";
type PageInfo = ShortsPageDto["page"];

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
  const sharing = useShareLink();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"participants" | "comments" | "report" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shorts, setShorts] = useState<ShortItemDto[]>([]);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [index, setIndex] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextFailed, setNextFailed] = useState(false);
  const [mediaFailedShortId, setMediaFailedShortId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreRef = useRef(false);
  const feedGeneration = useRef(0);
  const moreRequest = useRef<AbortController | null>(null);
  const currentShortIdRef = useRef<number | undefined>(undefined);

  // The feed (with its cursor) loads once per account; the URL's short is read when it loads. A shared/saved
  // deep link outside the first page is read directly instead of scanning the feed for it.
  const linkedShortId = useEffectEvent(() => initialShortId);
  useEffect(() => {
    const controller = new AbortController();
    const target = linkedShortId();
    // A reloaded feed (account change or new link) invalidates any in-flight next-page request.
    feedGeneration.current++;
    moreRequest.current?.abort();
    (async () => {
      const result = await getShorts(undefined, controller.signal);
      let items = result.items;
      if (target != null && !items.some((item) => item.shortId === target)) {
        const linked = await getShort(target, controller.signal).catch((cause) => {
          if (cause instanceof ApiError && cause.status === 404) return null;
          throw cause;
        });
        if (linked) items = [linked, ...items];
      }
      if (controller.signal.aborted) return;
      setShorts(items);
      setPage(result.page);
      setIndex(initialShortIndex(items, target));
      setFeedState("ready");
    })().catch(() => {
      if (!controller.signal.aborted) setFeedState("error");
    });
    return () => {
      controller.abort();
      moreRequest.current?.abort();
    };
  }, [reloadKey, currentUserId]);

  // Selecting a short rewrites the URL to it; only a URL change to a short that is not loaded needs a reload.
  const [seenLinkedId, setSeenLinkedId] = useState(initialShortId);
  if (initialShortId !== seenLinkedId) {
    setSeenLinkedId(initialShortId);
    const found = shorts.findIndex((item) => item.shortId === initialShortId);
    if (found >= 0) setIndex(found);
    else if (initialShortId != null) setReloadKey((key) => key + 1);
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
  const hasNext = index < shorts.length - 1 || Boolean(page?.hasMore && page.nextCursor != null);
  const playback = useShortPlayback({ short: current ?? null, audioRef, muted, mode, onNext: selectNext });
  const progress = playback.totalMs > 0 ? Math.min(100, (playback.positionMs / playback.totalMs) * 100) : 0;
  useLayoutEffect(() => {
    currentShortIdRef.current = current?.shortId;
  });

  function selectShort(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= shorts.length) return;
    audioRef.current?.pause();
    setNextFailed(false);
    setFeedback(null);
    setSheet(null);
    setIndex(nextIndex);
    onRememberShort?.(shorts[nextIndex].shortId);
  }

  async function selectNext() {
    if (index < shorts.length - 1) {
      selectShort(index + 1);
      return;
    }
    if (!page?.hasMore || page.nextCursor == null || loadingMoreRef.current) return;

    const generation = feedGeneration.current;
    const requestedFrom = current?.shortId;
    const loadedCount = shorts.length;
    const controller = new AbortController();
    moreRequest.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setNextFailed(false);
    try {
      const next = await getShorts(page.nextCursor, controller.signal);
      if (controller.signal.aborted || generation !== feedGeneration.current) return;
      setPage(next.items.length ? next.page : { ...next.page, hasMore: false });
      // A deep-linked short is prepended to the first page, so its own page must not add it twice: the URL sync
      // would jump back to the first copy and loop the feed.
      const fresh = next.items.filter((item) => !shorts.some((loaded) => loaded.shortId === item.shortId));
      if (!fresh.length) return;
      setShorts((previous) => [...previous, ...fresh]);
      // Only move on when the listener is still on the short that asked for the next page.
      if (currentShortIdRef.current !== requestedFrom) return;
      audioRef.current?.pause();
      setFeedback(null);
      setSheet(null);
      setIndex(loadedCount);
      onRememberShort?.(fresh[0].shortId);
    } catch {
      if (!controller.signal.aborted && generation === feedGeneration.current) setNextFailed(true);
    } finally {
      if (moreRequest.current === controller) {
        moreRequest.current = null;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  // Confirm, backdrop, grip and Escape all apply the sheet's selection the same way.
  const closeParticipants = () => {
    playback.applyDraft();
    setSheet(null);
  };

  const replaceCurrent = (next: ShortItemDto) =>
    setShorts((items) => items.map((item) => (item.shortId === next.shortId ? next : item)));
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await action();
    } catch (cause) {
      setFeedback(actionError(cause));
    } finally {
      setBusy(false);
    }
  }
  const vote = (kind: "like" | "dislike") =>
    run(async () => {
      await reactToShort(current.shortId, kind);
      // The reaction response has only the requested side; the detail has both.
      replaceCurrent(await getShort(current.shortId));
    });
  const bookmark = () =>
    run(async () => {
      const result = await toggleShortBookmark(current.shortId);
      replaceCurrent({ ...current, isBookmarked: result.isBookmarked });
    });
  const share = () =>
    run(async () => {
      const { shareUrl } = await getShortShareLink(current.shortId);
      setFeedback(await sharing.share(current.title, canonicalShareLink("short", current.shortId, shareUrl, window.location.origin)));
    });

  if (feedState === "loading") {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="status">
        숏폼을 불러오는 중입니다.
      </div>
    );
  }
  if (feedState === "error") {
    return (
      <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="alert">
        <p>숏폼을 불러오지 못했습니다.</p>
        <button
          onClick={() => {
            setFeedState("loading");
            setReloadKey((key) => key + 1);
          }}
        >
          다시 시도
        </button>
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
            onClick={() => void vote("like")}
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
            onClick={() => void vote("dislike")}
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
          onClick={() => {
            void share();
          }}
          aria-label="공유"
        >
          <IconSlot name="abyss-share.svg" kind="short-share" />
        </button>
        <button
          className={sharedStyles.saveControl}
          aria-label="저장"
          aria-pressed={current.isBookmarked}
          disabled={busy}
          onClick={() => void bookmark()}
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
              onSubmit={(reason, description) => reportShort(current.shortId, reason, description)}
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
          onCreated={() => {
            void getShort(current.shortId)
              .then(replaceCurrent)
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

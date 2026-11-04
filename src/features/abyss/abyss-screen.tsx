import { abyssStyles } from "@/styles/abyss.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AlbumCarousel } from "@/features/abyss/album-carousel";
import { ShortParticipants } from "@/features/abyss/short-participants";
import { AbyssComments } from "./abyss-comments";
import { FigmaSheet } from "@/components/ui/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { Asset } from "@/components/ui/asset";
import { IconSlot } from "@/components/ui/icon-slot";
import { canonicalShareLink } from "@/lib/api/content-link";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { shareLink } from "@/lib/share-link";
import { ApiError } from "@/lib/api/client";
import { canJoinShort } from "@/features/abyss/short-participation";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import {
  getShort,
  getShortShareLink,
  getShorts,
  reactToShort,
  recordShortView,
  toggleShortBookmark,
  toggleShortPlayback,
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
  onRememberShort,
}: {
  onRememberShort?: (id: number) => void;
  onProfile: (userId: number) => void;
  onJoin: (shortId: number) => void;
  initialShortId?: number | null;
  muted?: boolean;
}) {
  const currentUserId = useCurrentUserId();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"participants" | "comments" | "report" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shorts, setShorts] = useState<ShortItemDto[]>([]);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [index, setIndex] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreRef = useRef(false);

  // The feed (with its cursor) loads once per account; the URL's short is read when it loads. A shared/saved
  // deep link outside the first page is read directly instead of scanning the feed for it.
  const linkedShortId = useEffectEvent(() => initialShortId);
  useEffect(() => {
    const controller = new AbortController();
    const target = linkedShortId();
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
    return () => controller.abort();
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
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    if (!mediaUrl || !audioRef.current) return;
    void audioRef.current.play().catch(() => {
      // Browsers may block unmuted autoplay until the user interacts with the page.
    });
  }, [mediaUrl]);

  function selectShort(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= shorts.length) return;
    audioRef.current?.pause();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
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

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = await getShorts(page.nextCursor);
      setPage(next.items.length ? next.page : { ...next.page, hasMore: false });
      if (next.items.length) {
        audioRef.current?.pause();
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setPlaybackError(null);
        setFeedback(null);
        setIndex(shorts.length);
        setShorts((previous) => [...previous, ...next.items]);
        onRememberShort?.(next.items[0].shortId);
      }
    } catch {
      setPlaybackError("다음 숏폼을 불러오지 못했습니다.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;
    const willPlay = audio.paused;
    if (!willPlay) audio.pause();
    else {
      setPlaybackError(null);
      try {
        await audio.play();
      } catch {
        setPlaybackError("음원을 재생하지 못했습니다.");
        return;
      }
    }
    if (currentUserId !== null)
      void toggleShortPlayback(current.shortId, willPlay, audio.currentTime).catch(() => {});
  }

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
      setFeedback(await shareLink(current.title, canonicalShareLink("short", current.shortId, shareUrl, window.location.origin)));
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
            <i /> <button onClick={() => setSheet("participants")}>작곡 참여자 보기</button>
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
            onLoadedMetadata={(event) =>
              setDuration(
                Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
              )
            }
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => {
              if (mediaUrl) setPlaybackError("음원 파일을 불러오지 못했습니다.");
            }}
          />
          <input
            className={abyssStyles.abyssProgress}
            type="range"
            min={0}
            max={duration || 1}
            step="0.1"
            value={Math.min(currentTime, duration || 1)}
            style={{
              background: `linear-gradient(to right, #f2f4f6 ${progress}%, #303030 ${progress}%)`,
            }}
            onChange={(event) => {
              const time = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = time;
              setCurrentTime(time);
            }}
            aria-label="재생 위치"
            disabled={!mediaUrl || duration === 0}
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
              className={cn(abyssStyles.abyssToggle, playing ? sharedStyles.isPlaying : "")}
              onClick={togglePlayback}
              disabled={!mediaUrl}
              aria-label={playing ? "일시정지" : "재생"}
            />
            <button
              className={abyssStyles.abyssNext}
              onClick={selectNext}
              disabled={!hasNext || loadingMore}
              aria-label="다음 숏폼"
            />
          </div>
          {!mediaUrl && (
            <p className={abyssStyles.abyssPlaybackMessage}>재생 가능한 음원 파일이 없습니다.</p>
          )}
          {playbackError && (
            <p className={abyssStyles.abyssPlaybackMessage} role="alert">
              {playbackError}
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
          <FigmaSheet title="작곡 참여자" onClose={() => setSheet(null)}>
            <ShortParticipants short={current} onBeforePlay={() => audioRef.current?.pause()} />
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

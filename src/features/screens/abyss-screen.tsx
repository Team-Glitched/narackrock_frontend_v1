"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { ShortCommentsSheet } from "@/features/screens/short-comments";
import { ContentShareDialog } from "@/features/screens/content-share";
import { canJoinShort } from "@/features/abyss/short-participation";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getShorts, toggleShortBookmark, toggleShortReaction } from "@/lib/api/shorts";
import type { ShortItemDto, ShortsPageDto } from "@/lib/api/contracts";

type FeedState = "loading" | "ready" | "error";
type PageInfo = ShortsPageDto["page"];

export function AbyssScreen({ onJoin, initialShortId, muted = false }: { onJoin: (shortId: number) => void; initialShortId?: number | null; muted?: boolean }) {
  const currentUserId = useCurrentUserId();
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
  const [reactionBusy, setReactionBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      let result = await getShorts(undefined, controller.signal);
      const items = [...result.items];
      const seenCursors = new Set<number>();
      while (initialShortId != null && !items.some((item) => item.shortId === initialShortId)
        && result.page.hasMore && result.page.nextCursor != null && !seenCursors.has(result.page.nextCursor)) {
        seenCursors.add(result.page.nextCursor);
        result = await getShorts(result.page.nextCursor, controller.signal);
        items.push(...result.items);
      }
      if (controller.signal.aborted) return;
      setShorts(items);
      setPage(result.page);
      setIndex(initialShortIndex(items, initialShortId));
      setFeedState("ready");
    })().catch(() => {
        if (!controller.signal.aborted) setFeedState("error");
      });
    return () => controller.abort();
  }, [reloadKey, initialShortId]);

  const current = shorts[index];
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
    setCommentsOpen(false);
    setShareOpen(false);
    audioRef.current?.pause();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    setIndex(nextIndex);
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
        selectShort(shorts.length);
        setShorts((previous) => [...previous, ...next.items]);
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
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPlaybackError(null);
    try {
      await audio.play();
    } catch {
      setPlaybackError("음원을 재생하지 못했습니다.");
    }
  }

  async function react(type: "like" | "dislike") {
    if (!current || reactionBusy) return;
    setReactionBusy(true);
    setActionError(null);
    try {
      const result = await toggleShortReaction(current.shortId, type);
      setShorts(items => items.map(item => item.shortId !== current.shortId ? item : {
        ...item,
        isLiked: type === "like" ? Boolean(result.isLiked) : false,
        isDisliked: type === "dislike" ? Boolean(result.isDisliked) : false,
        likeCount: type === "like" ? result.likeCount ?? item.likeCount : Math.max(0, item.likeCount - (item.isLiked ? 1 : 0)),
        dislikeCount: type === "dislike" ? result.dislikeCount ?? item.dislikeCount : Math.max(0, item.dislikeCount - (item.isDisliked ? 1 : 0)),
      }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "반응을 저장하지 못했습니다.");
    } finally { setReactionBusy(false); }
  }

  async function bookmark() {
    if (!current || bookmarkBusy) return;
    setBookmarkBusy(true); setActionError(null);
    try {
      const result = await toggleShortBookmark(current.shortId);
      setShorts(items => items.map(item => item.shortId === current.shortId ? { ...item, isBookmarked: result.isBookmarked } : item));
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "북마크를 저장하지 못했습니다."); }
    finally { setBookmarkBusy(false); }
  }

  if (feedState === "loading") {
    return <div className="abyss-view abyss-state" role="status">숏폼을 불러오는 중입니다.</div>;
  }
  if (feedState === "error") {
    return <div className="abyss-view abyss-state" role="alert"><p>숏폼을 불러오지 못했습니다.</p><button onClick={() => { setFeedState("loading"); setReloadKey((key) => key + 1); }}>다시 시도</button></div>;
  }
  if (!current) {
    return <div className="abyss-view abyss-state">아직 공개된 숏폼이 없습니다.</div>;
  }

  return (
    <div className="abyss-view">
      <div className="abyss-song">
        {current.albumImageUrl ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.albumImageUrl} alt={`${current.title} 앨범 커버`} className="abyss-cover" />
        </> : <div className="abyss-cover abyss-cover-empty" role="img" aria-label={`${current.title} 앨범 이미지 없음`}><span>♪</span></div>}
        <div className="abyss-title">
          <h1>{current.title}</h1>
          <p>{current.author.nickname} <i /> <button disabled>작곡 참여자 보기</button></p>
        </div>
      </div>
      <div className="abyss-actions">
        <div className="abyss-vote">
          <button className={current.isLiked ? "active" : ""} aria-label={`좋아요 ${current.likeCount}개`} aria-pressed={current.isLiked} disabled={reactionBusy} onClick={() => react("like")}><Asset name={current.isLiked ? "like-filled.svg" : "like.svg"} />{current.likeCount}</button>
          <i />
          <button className={`abyss-dislike ${current.isDisliked ? "active" : ""}`} aria-label={`싫어요 ${current.dislikeCount}개`} aria-pressed={current.isDisliked} disabled={reactionBusy} onClick={() => react("dislike")}><Asset name={current.isDisliked ? "like-filled.svg" : "like.svg"} />{current.dislikeCount}</button>
        </div>
        <button aria-label={`댓글 ${current.commentCount}개`} onClick={() => setCommentsOpen(true)}><Asset name="comment.svg" />{current.commentCount}</button>
        <button aria-label="숏폼 공유" onClick={() => setShareOpen(true)}><Asset name="share.svg" /></button>
        <button disabled={bookmarkBusy} aria-label="숏폼 북마크" aria-pressed={current.isBookmarked} onClick={bookmark}><Asset name={current.isBookmarked ? "bookmark-filled.svg" : "bookmark.svg"} /></button>
      </div>
      {actionError && <p className="abyss-action-error" role="alert">{actionError}</p>}
      <div className="abyss-player">
        <audio
          key={current.shortId}
          ref={audioRef}
          src={mediaUrl ?? undefined}
          preload="metadata"
          autoPlay
          muted={muted}
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { if (mediaUrl) setPlaybackError("음원 파일을 불러오지 못했습니다."); }}
        />
        <input
          className="abyss-progress"
          type="range"
          min={0}
          max={duration || 1}
          step="0.1"
          value={Math.min(currentTime, duration || 1)}
          style={{ background: `linear-gradient(to right, #f2f4f6 ${progress}%, #303030 ${progress}%)` }}
          onChange={(event) => {
            const time = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          aria-label="재생 위치"
          disabled={!mediaUrl || duration === 0}
        />
        <div className="abyss-player-controls">
          <Asset name="abyss-player.svg" />
          <button className="abyss-previous" onClick={() => selectShort(index - 1)} disabled={index === 0} aria-label="이전 숏폼" />
          <button className={`abyss-toggle ${playing ? "is-playing" : ""}`} onClick={togglePlayback} disabled={!mediaUrl} aria-label={playing ? "일시정지" : "재생"} />
          <button className="abyss-next" onClick={selectNext} disabled={!hasNext || loadingMore} aria-label="다음 숏폼" />
        </div>
        {!mediaUrl && <p className="abyss-playback-message">재생 가능한 음원 파일이 없습니다.</p>}
        {playbackError && <p className="abyss-playback-message" role="alert">{playbackError}</p>}
      </div>
      {current.completionStatus === "IN_PROGRESS" && current.projectId != null && (
        <div className="abyss-join-slot">
          {canJoinShort(current, currentUserId) && <button className="abyss-join" onClick={() => onJoin(current.shortId)}>작곡 참여하기</button>}
        </div>
      )}
      {commentsOpen && <ShortCommentsSheet key={current.shortId} shortId={current.shortId} onClose={() => setCommentsOpen(false)} onCountChange={delta => setShorts(items => items.map(item => item.shortId === current.shortId ? { ...item, commentCount: Math.max(0, item.commentCount + delta) } : item))} />}
      {shareOpen && <ContentShareDialog content={{ kind: "short", id: current.shortId }} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { getShorts } from "@/lib/api/shorts";
import type { ShortItemDto, ShortsPageDto } from "@/lib/api/contracts";

type FeedState = "loading" | "ready" | "error";
type PageInfo = ShortsPageDto["page"];

export function AbyssScreen({ go }: { go: Navigate }) {
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

  useEffect(() => {
    const controller = new AbortController();
    getShorts(undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setShorts(result.items);
        setPage(result.page);
        setIndex(0);
        setFeedState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setFeedState("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  const current = shorts[index];
  const mediaUrl = current?.mediaUrl?.trim() || null;
  const hasNext = index < shorts.length - 1 || Boolean(page?.hasMore && page.nextCursor != null);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  function selectShort(nextIndex: number) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.albumImageUrl || "/figma/abyss-album.png"} alt={`${current.title} 앨범 커버`} className="abyss-cover" />
        <div className="abyss-title">
          <h1>{current.title}</h1>
          <p>{current.author.nickname} <i /> <button disabled>작곡 참여자 보기</button></p>
        </div>
      </div>
      <div className="abyss-actions">
        <div className="abyss-vote">
          <button className={current.isLiked ? "active" : ""} aria-label={`좋아요 ${current.likeCount}개`} disabled><Asset name="like.svg" />{current.likeCount}</button>
          <i />
          <button className="abyss-dislike" aria-label={`싫어요 ${current.dislikeCount}개`} disabled><Asset name="like.svg" /></button>
        </div>
        <button disabled aria-label={`댓글 ${current.commentCount}개`}><Asset name="comment.svg" />{current.commentCount}</button>
        <button disabled aria-label="공유"><Asset name="share.svg" /></button>
        <button disabled aria-label="저장"><Asset name="bookmark.svg" /></button>
      </div>
      <div className="abyss-player">
        <audio
          key={current.shortId}
          ref={audioRef}
          src={mediaUrl ?? undefined}
          preload="metadata"
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
      <button className="abyss-join" onClick={() => go("studio")}>작곡 참여하기</button>
    </div>
  );
}

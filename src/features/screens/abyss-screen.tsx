import { abyssStyles } from "@/styles/abyss.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useRef, useState } from "react";
import { AlbumCarousel } from "@/features/abyss/album-carousel";
import { useSavedItems } from "@/features/saved/saved-store";
import { AbyssComments } from "./abyss-comments";
import type { Navigate } from "@/features/navigation/types";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { ReportReasons } from "@/components/app/report-reasons";
import { Asset, Avatar, IconSlot } from "@/components/app/shared";
import { initialShortIndex } from "@/features/abyss/initial-short";
import { canJoinShort } from "@/features/abyss/short-participation";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getShorts } from "@/lib/api/shorts";
import type { ShortItemDto, ShortsPageDto } from "@/lib/api/contracts";

type FeedState = "loading" | "ready" | "error";
type PageInfo = ShortsPageDto["page"];

export function AbyssScreen({ go, onJoin, initialShortId, muted = false, previewItems, onRememberShort }: { onRememberShort?:(id:number)=>void; go: Navigate; onJoin: (shortId: number) => void; initialShortId?: number | null; muted?: boolean; previewItems?: ShortItemDto[] }) {
  const currentUserId = useCurrentUserId();
  const savedItems = useSavedItems();
  const [sheet, setSheet] = useState<"participants" | "comments" | "report" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shorts, setShorts] = useState<ShortItemDto[]>(previewItems ?? []);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [index, setIndex] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>(previewItems ? "ready" : "loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (previewItems) return;
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
  }, [reloadKey, initialShortId, previewItems]);

  const current = shorts[index];
  const navigate:Navigate=(view,id)=>{if(view==="profile"&&current)onRememberShort?.(current.shortId);go(view,id);};
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
        setPlaying(false); setCurrentTime(0); setDuration(0); setPlaybackError(null); setFeedback(null);
        setIndex(shorts.length);
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

  function vote(kind: "like" | "dislike") {
    setShorts(items => items.map((item, position) => {
      if (position !== index) return item;
      const liked = kind === "like" ? !item.isLiked : false;
      const disliked = kind === "dislike" ? !item.isDisliked : false;
      return { ...item, isLiked: liked, isDisliked: disliked,
        likeCount: Math.max(0, item.likeCount + Number(liked) - Number(item.isLiked)),
        dislikeCount: Math.max(0, item.dislikeCount + Number(disliked) - Number(item.isDisliked)) };
    }));
    setFeedback(null);
  }
  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set("short", String(current.shortId));
    try {
      if (navigator.share) await navigator.share({ title: current.title, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setFeedback("링크를 복사했습니다."); }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setFeedback("링크를 공유하지 못했습니다."); }
  }

  if (feedState === "loading") {
    return <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="status">숏폼을 불러오는 중입니다.</div>;
  }
  if (feedState === "error") {
    return <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)} role="alert"><p>숏폼을 불러오지 못했습니다.</p><button onClick={() => { setFeedState("loading"); setReloadKey((key) => key + 1); }}>다시 시도</button></div>;
  }
  if (!current) {
    return <div className={cn(abyssStyles.abyssView, abyssStyles.abyssState)}>아직 공개된 숏폼이 없습니다.</div>;
  }

  return (
    <div className={abyssStyles.abyssView}>
      <div className={abyssStyles.abyssSong}>
        <AlbumCarousel items={shorts} index={index} onPrevious={() => selectShort(index - 1)} onNext={() => { void selectNext(); }} />
        <div className={abyssStyles.abyssTitle}>
          <h1>{current.title}</h1>
          <p><button onClick={() => navigate("profile", current.author.userId)}>{current.author.nickname}</button> <i /> <button onClick={() => setSheet("participants")}>작곡 참여자 보기</button></p>
        </div>
      </div>
      <div className={abyssStyles.abyssActions}>
        <div className={abyssStyles.abyssVote}>
          <button className={current.isLiked ? sharedStyles.active : ""} aria-label={`좋아요 ${current.likeCount}개`} aria-pressed={current.isLiked} onClick={() => vote("like")}><IconSlot name={current.isLiked ? "v3-short-like-on.svg" : "v3-short-like-off.svg"} kind="short" /><span className={abyssStyles.abyssLikeCount}>{current.likeCount}</span></button>
          <i />
          <button className={abyssStyles.abyssDislike} aria-label={`싫어요 ${current.dislikeCount}개`} aria-pressed={current.isDisliked} onClick={() => vote("dislike")}><IconSlot name={current.isDisliked ? "v3-short-dislike-on.svg" : "v3-short-dislike-off.svg"} kind="short" /></button>
        </div>
        <button onClick={() => setSheet("comments")} aria-label={`댓글 ${current.commentCount}개`}><IconSlot name="abyss-comment.svg" kind="short" />{current.commentCount}</button>
        <button className={abyssStyles.abyssShare} onClick={() => { void share(); }} aria-label="공유"><IconSlot name="abyss-share.svg" kind="short-share" /></button>
        <button className={sharedStyles.saveControl} aria-label="저장" aria-pressed={savedItems.has("song", current.shortId)} onClick={() => { try { savedItems.toggle({id: current.shortId, kind: "song", title: current.title, author: current.author.nickname, imageUrl: current.albumImageUrl}); setFeedback(null); } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "저장하지 못했습니다."); } }}><IconSlot name={savedItems.has("song", current.shortId) ? "save-on.svg" : "save-off.svg"} kind="short-save" /></button>
        <button className={abyssStyles.abyssReport} aria-label="신고" onClick={()=>setSheet("report")}><Asset name="short-report.svg" /></button>
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
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { if (mediaUrl) setPlaybackError("음원 파일을 불러오지 못했습니다."); }}
        />
        <input
          className={abyssStyles.abyssProgress}
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
        <div className={abyssStyles.abyssPlayerControls}>
          <Asset name="abyss-player.svg" />
          <button className={abyssStyles.abyssPrevious} onClick={() => selectShort(index - 1)} disabled={index === 0} aria-label="이전 숏폼" />
          <button className={cn(abyssStyles.abyssToggle, playing ? sharedStyles.isPlaying : "")} onClick={togglePlayback} disabled={!mediaUrl} aria-label={playing ? "일시정지" : "재생"} />
          <button className={abyssStyles.abyssNext} onClick={selectNext} disabled={!hasNext || loadingMore} aria-label="다음 숏폼" />
        </div>
        {!mediaUrl && <p className={abyssStyles.abyssPlaybackMessage}>재생 가능한 음원 파일이 없습니다.</p>}
        {playbackError && <p className={abyssStyles.abyssPlaybackMessage} role="alert">{playbackError}</p>}
      </div>
      {sheet === "report" && <FigmaSheet title="신고" onClose={()=>setSheet(null)}><ReportReasons /></FigmaSheet>}
      {feedback && <p className={abyssStyles.abyssFeedback} role="status">{feedback}</p>}
      {sheet === "participants" && <FigmaSheet title="작곡 참여자" onClose={() => setSheet(null)}><ul className={sharedStyles.participantList}>{current.participants.length ? current.participants.map(person => <li key={person.userId}><Avatar /><span><strong>{person.nickname}</strong><small>{person.role === "CREATOR" ? "원곡자" : "작곡 참여자"}</small></span></li>) : <li>아직 참여자가 없습니다.</li>}</ul></FigmaSheet>}
      <AbyssComments key={current.shortId} shortId={current.shortId} onCreated={() => setShorts(items => items.map(item => item.shortId === current.shortId ? {...item,commentCount:item.commentCount+1} : item))} commentCount={current.commentCount} open={sheet === "comments"} onClose={() => setSheet(null)} go={navigate} />
      {current.completionStatus === "IN_PROGRESS" && current.projectId != null && (
        <div className={abyssStyles.abyssJoinSlot}>
          {canJoinShort(current, currentUserId) && <button className={abyssStyles.abyssJoin} onClick={() => onJoin(current.shortId)}>작곡 참여하기</button>}
        </div>
      )}
      </div>
    </div>
  );
}

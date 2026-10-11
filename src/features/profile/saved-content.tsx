"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Asset, Avatar } from "@/components/app/shared";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getBookmarkedPosts, getBookmarkedShorts } from "@/lib/api/profile";
import type { BookmarkedPost, BookmarkedShort } from "@/lib/api/profile";
import "./saved-content.css";

type Tab = "posts" | "shorts";
function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNow(date, { addSuffix: true, locale: ko });
}

export function SavedContentScreen({ onOpenPost, onOpenShort }: { onOpenPost: (id: number) => void; onOpenShort: (id: number) => void }) {
  const userId = useCurrentUserId();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<BookmarkedPost[]>([]);
  const [shorts, setShorts] = useState<BookmarkedShort[]>([]);
  const [postPage, setPostPage] = useState(0);
  const [postTotal, setPostTotal] = useState(0);
  const [shortCursor, setShortCursor] = useState<number | null>(null);
  const [shortHasMore, setShortHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Record<Tab, boolean>>({ posts: false, shorts: false });

  const tabLoaded = loaded[tab];
  useEffect(() => {
    if (userId === null || tabLoaded || error) return;
    let cancelled = false;
    const request = tab === "posts" ? getBookmarkedPosts() : getBookmarkedShorts();
    request.then(result => {
      if (cancelled) return;
      if (tab === "posts" && "posts" in result) {
        setPosts(result.posts); setPostTotal(result.totalCount); setPostPage(result.page);
      } else if (tab === "shorts" && "items" in result) {
        setShorts(result.items); setShortCursor(result.page.nextCursor); setShortHasMore(result.page.hasMore);
      }
      setLoaded(current => ({ ...current, [tab]: true }));
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "북마크를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [tab, userId, tabLoaded, error]);

  async function more() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (tab === "posts") {
        const next = await getBookmarkedPosts(postPage + 1);
        setPosts(current => [...current, ...next.posts.filter(item => !current.some(old => old.postId === item.postId))]);
        setPostPage(next.page); setPostTotal(next.totalCount);
      } else if (shortCursor !== null) {
        const next = await getBookmarkedShorts(shortCursor);
        setShorts(current => [...current, ...next.items.filter(item => !current.some(old => old.shortId === item.shortId))]);
        setShortCursor(next.page.nextCursor); setShortHasMore(next.page.hasMore);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "북마크를 더 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  if (userId === null) return <p className="saved-content-state">본인의 북마크는 로그인 후 확인할 수 있습니다.</p>;
  const entries = tab === "posts" ? posts : shorts;
  const hasMore = tab === "posts" ? posts.length < postTotal : shortHasMore;

  return <div className="saved-content-view scroll-content">
    <div className="saved-content-tabs" role="tablist" aria-label="저장한 콘텐츠 종류">
      <button role="tab" aria-selected={tab === "posts"} className={tab === "posts" ? "active" : ""} onClick={() => { setError(null); setTab("posts"); }}>게시물</button>
      <button role="tab" aria-selected={tab === "shorts"} className={tab === "shorts" ? "active" : ""} onClick={() => { setError(null); setTab("shorts"); }}>음악</button>
    </div>
    {error && <p className="saved-content-state" role="alert">{error} <button onClick={() => { setError(null); setLoaded(current => ({ ...current, [tab]: false })); }}>다시 시도</button></p>}
    {!tabLoaded && !error && <p className="saved-content-state" role="status">북마크를 불러오는 중...</p>}
    {loaded[tab] && entries.length === 0 && !error && <p className="saved-content-state">저장한 {tab === "posts" ? "게시물" : "음악"}이 없습니다.</p>}
    {tab === "posts" && <div className="saved-post-list">{posts.map(post => <button className="saved-post" key={post.postId} onClick={() => onOpenPost(post.postId)}>
      <span className="saved-post-image">{post.imageUrl && <Image src={post.imageUrl} alt="" width={90} height={90} unoptimized />}</span>
      <span className="saved-post-copy"><strong>{post.title}</strong><span className="saved-post-meta">{time(post.createdAt)} <span><Asset name="like.svg" />{post.likeCount}</span><span><Asset name="comment.svg" />{post.commentCount}</span></span><span className="saved-post-author"><Avatar src={post.writer.profileImageUrl} />{post.writer.nickname}</span></span>
    </button>)}</div>}
    {tab === "shorts" && <div className="saved-short-list">{shorts.map(short => <button className="saved-short" key={short.shortId} onClick={() => onOpenShort(short.shortId)}>
      <span className="saved-short-image">{short.albumImageUrl && <Image src={short.albumImageUrl} alt="" width={52} height={52} unoptimized />}</span>
      <span className="saved-short-copy"><strong>{short.title}</strong><small>{short.author.nickname}</small></span>
    </button>)}</div>}
    {loaded[tab] && hasMore && <button className="saved-content-more" onClick={more} disabled={busy}>{busy ? "불러오는 중..." : "더 보기"}</button>}
  </div>;
}

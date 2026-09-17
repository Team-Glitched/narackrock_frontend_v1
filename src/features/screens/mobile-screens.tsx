"use client";

import "./community.css";
import { CommunityDirectory } from "./community-directory";
import type { Community } from "./community-card";

import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useState } from "react";
import { Asset, Avatar, postImages, SectionTitle, SongRail } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useGalleryPosts } from "@/hooks/use-gallery-posts";
import { createPost, DEFAULT_GALLERY_ID, deletePost, fetchPost, updatePost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { ApiError, getAccessToken } from "@/lib/api/client";

function postError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403) return "이 작업을 수행할 권한이 없습니다. 계정 상태와 작성자를 확인해주세요.";
    if (error.status === 404) return "게시글을 찾을 수 없습니다. 목록을 새로고침해주세요.";
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function relativeTime(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ko });
}

function PostListStatus({ state }: { state: "loading" | "error" | "empty" }) {
  const message = state === "loading" ? "게시글을 불러오는 중..." : state === "error" ? "게시글을 불러오지 못했습니다." : "아직 게시글이 없어요.";
  return <p className="empty-community" style={{ height: "auto", padding: "40px 20px" }}>{message}</p>;
}

function MiniPost({ tall = false, post }: { tall?: boolean; post: PostListItem }) { return <article className={`mini-post ${tall ? "mini-post--tall" : ""}`}><div className="mini-post-copy"><strong>{post.title}</strong><div className="mini-meta"><span>{relativeTime(post.createdAt)}</span><span><Asset name="like.svg" />{post.likeCount}</span><span><Asset name="comment.svg" />{post.commentCount}</span></div><div className="mini-author"><Avatar src={post.writer.profileImageUrl} /><span>{post.writer.nickname}</span></div></div></article>; }
function BackTitle({ title, go }: { title: string; go: Navigate }) { return <div className="back-title"><button aria-label="뒤로" onClick={() => go("home")}><Asset name="return.svg" /></button><h1>{title}</h1></div>; }

export function HomeScreen({ go }: { go: Navigate }) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);
  return <div className="home-content scroll-content"><section><SectionTitle onAll={() => go("charts")}>인기 곡</SectionTitle><SongRail /></section><section><SectionTitle onAll={() => go("posts")}>인기 글</SectionTitle><div className="mini-post-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.slice(0, 3).map(post => <MiniPost key={post.postId} post={post} />)}</div></section><section><SectionTitle onAll={() => go("charts")}>내 곡</SectionTitle><SongRail /></section></div>;
}
export function ChartsScreen({ go }: { go: Navigate }) { return <div className="list-view scroll-content"><BackTitle title="인기차트" go={go} /><div className="chart-list">{Array.from({ length: 12 }).map((_, i) => <button className="chart-row" key={i}><span className="chart-art"><Asset name={postImages[(i * 5) % postImages.length]} alt="곡 커버" /></span><span><strong>Name</strong><small>name</small></span><Asset name="option.svg" /></button>)}</div></div>; }
export function PostsScreen({ go }: { go: Navigate }) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);
  return <div className="list-view scroll-content"><BackTitle title="인기글" go={go} /><div className="posts-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.map(post => <MiniPost tall key={post.postId} post={post} />)}</div></div>;
}
export function AbyssScreen({ go }: { go: Navigate }) { const [playing, setPlaying] = useState(false); const [liked, setLiked] = useState(false); return <div className="abyss-view"><div className="abyss-song"><Asset name="abyss-album.png" alt="Pretender 앨범 커버" className="abyss-cover" /><div className="abyss-title"><h1>Pretender</h1><p>min chong <i /> <button>작곡 참여자 보기</button></p></div></div><div className="abyss-actions"><div className="abyss-vote"><button className={liked ? "active" : ""} onClick={() => setLiked(!liked)} aria-label="좋아요"><Asset name="like.svg" />116</button><i /><button aria-label="싫어요" className="abyss-dislike"><Asset name="like.svg" /></button></div><button><Asset name="comment.svg" />116</button><button aria-label="공유"><Asset name="share.svg" /></button><button aria-label="저장"><Asset name="bookmark.svg" /></button></div><div className="abyss-player"><button className="abyss-progress" aria-label="재생 위치"><i style={{ width: playing ? "38%" : "18%" }}><b /></i></button><button className="abyss-player-controls" aria-label={playing ? "일시정지" : "재생"} onClick={() => setPlaying(!playing)}><Asset name="abyss-player.svg" /></button></div><button className="abyss-join" onClick={() => go("studio")}>작곡 참여하기</button></div>; }
export function FriendsScreen() { const [following, setFollowing] = useState([false, true, true, false]); const [requests, setRequests] = useState([true, true]); return <div className="friends-view scroll-content"><section><SectionTitle>팔로우 추천</SectionTitle><div className="people-list">{following.map((on, i) => <div className="person" key={i}><Avatar /><span><strong>Muhehehe</strong><small>피아노</small></span><button className="purple-pill" onClick={() => setFollowing(s => s.map((v, x) => x === i ? !v : v))}>{on ? "맞팔로우" : "팔로우"}</button></div>)}</div></section><section><SectionTitle>팔로우 요청</SectionTitle><div className="people-list">{requests.map((show, i) => show && <div className="person" key={i}><Avatar /><span><strong>Muhehehe</strong><small>피아노</small></span><button className="purple-pill compact" onClick={() => setRequests(s => s.map((v, x) => x === i ? false : v))}>확인</button><button className="gray-pill" onClick={() => setRequests(s => s.map((v, x) => x === i ? false : v))}>취소</button></div>)}</div></section></div>; }
export function SearchScreen({ go }: { go: Navigate }) { const [query, setQuery] = useState(""); return <div className="search-view"><div className="search-line"><button onClick={() => go("home")} aria-label="뒤로"><Asset name="return.svg" /></button><label><Asset name="search.svg" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}</label></div>{query && <p className="search-result">‘{query}’ 검색 결과가 없습니다.</p>}</div>; }
export function PostComposer({ galleryId, onCreated, onCancel }: { galleryId: number; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPost(galleryId, title, content);
      setTitle("");
      setContent("");
      onCreated();
    } catch (error) {
      setError(postError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="post-form">
      <input aria-label="게시글 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" disabled={submitting} />
      <textarea aria-label="게시글 내용" value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요" disabled={submitting} />
      {error && <p className="post-form-error">{error}</p>}
      <div className="post-form-actions">
        <button className="gray-pill compact" onClick={onCancel} disabled={submitting}>취소</button>
        <button className="purple-pill compact" onClick={submit} disabled={submitting}>{submitting ? "게시 중..." : "게시"}</button>
      </div>
    </div>
  );
}

export function CommunityPost({ post, onChanged, onCompose, onComments }: { post: PostListItem; onChanged: () => void; onCompose: () => void; onComments: (postId: number) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    fetchPost(post.postId).then(detail => {
      if (!cancelled) setPreview(detail.content);
    }).catch(error => {
      if (!cancelled) setError(postError(error));
    });
    return () => { cancelled = true; };
  }, [post]);

  async function readPost() {
    if (preview !== null) { setExpanded(value => !value); return; }
    setSubmitting(true);
    setError(null);
    try {
      const detail = await fetchPost(post.postId);
      setPreview(detail.content);
      setExpanded(true);
    } catch (error) { setError(postError(error)); }
    finally { setSubmitting(false); }
  }

  async function startEdit() {
    setMenuOpen(false);
    setError(null);
    setSubmitting(true);
    try {
      const detail = await fetchPost(post.postId);
      setTitle(detail.title);
      setContent(detail.content);
      setEditing(true);
    } catch (error) {
      setError(postError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updatePost(post.postId, title, content);
      setPreview(content);
      setEditing(false);
      onChanged();
    } catch (error) {
      setError(postError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    setMenuOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      await deletePost(post.postId);
      onChanged();
    } catch (error) {
      setError(postError(error));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  }

  if (editing) {
    return (
      <article className="community-post">
        <div className="post-form">
          <input aria-label="게시글 제목 수정" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" disabled={submitting} />
          <textarea aria-label="게시글 내용 수정" value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요" disabled={submitting} />
          {error && <p className="post-form-error">{error}</p>}
          <div className="post-form-actions">
            <button className="gray-pill compact" onClick={() => setEditing(false)} disabled={submitting}>취소</button>
            <button className="purple-pill compact" onClick={saveEdit} disabled={submitting}>{submitting ? "저장 중..." : "저장"}</button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="community-post">
      <div className="community-author">
        <Avatar src={post.writer.profileImageUrl} />
        <strong>{post.writer.nickname || "알 수 없는 사용자"}</strong>
        <span>• {relativeTime(post.createdAt)}</span>
        <button disabled={submitting} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="게시글 더보기"><Asset name="option.svg" /></button>
      </div>
      {menuOpen && <div className="post-menu-actions"><button className="gray-pill compact" onClick={onCompose}>글쓰기</button><button className="gray-pill compact" onClick={startEdit}>수정</button><button className="gray-pill compact" onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}>삭제</button></div>}
      <h2><button className="post-read" disabled={submitting} onClick={readPost} aria-expanded={expanded}>{post.title}</button></h2>
      <button className={`post-preview ${expanded ? "expanded" : ""}`} onClick={readPost} disabled={submitting}>{preview ?? "로그인 후 게시글 내용을 확인할 수 있어요."}</button>
      {error && <p className="post-form-error" role="alert">{error}</p>}
      {confirmDelete && <div className="post-delete-confirm" role="group" aria-label="게시글 삭제 확인"><p>이 게시글을 삭제할까요?</p><button className="gray-pill" disabled={submitting} onClick={() => setConfirmDelete(false)}>취소</button><button className="purple-pill" disabled={submitting} onClick={remove}>{submitting ? "삭제 중..." : "삭제 확인"}</button></div>}
      <div className="community-image" role="img" aria-label="첨부 이미지 없음" />
      <div className="community-actions">
        <div className="community-vote"><button disabled aria-label={`좋아요 ${post.likeCount}개, 준비 중`} title="좋아요 기능 준비 중"><Asset name="like.svg" />{post.likeCount}</button><span /><button disabled aria-label="싫어요 기능 준비 중" title="싫어요 기능 준비 중"><Asset name="like.svg" className="thumb-down" /></button></div>
        <button onClick={() => onComments(post.postId)} aria-label={`댓글 ${post.commentCount}개 보기`}><Asset name="comment.svg" />{post.commentCount}</button>
        <i />
        <button disabled aria-label="공유 기능 준비 중" title="공유 기능 준비 중"><Asset name="share.svg" /></button>
        <button disabled aria-label="북마크 기능 준비 중" title="북마크 기능 준비 중"><Asset name="bookmark.svg" /></button>
      </div>
    </article>
  );
}

export type CommunityTab = "posts" | "community";

// tab은 page.tsx가 들고 있다 — "모두보기"로 전체 목록에 다녀와도 커뮤니티 탭이 유지되도록.
export function CommunityScreen({ go, tab, onTabChange, onComments, onOpenCommunity }: { go: Navigate; tab: CommunityTab; onTabChange: (tab: CommunityTab) => void; onComments: (postId: number) => void; onOpenCommunity: (community: Community) => void }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);

  return (
    <div className="community-view scroll-content">
      <div className="community-tabs" aria-label="소셜 메뉴">
        <button aria-pressed={tab === "posts"} className={tab === "posts" ? "active" : ""} onClick={() => onTabChange("posts")}>게시글</button>
        <button aria-pressed={tab === "community"} className={tab === "community" ? "active" : ""} onClick={() => onTabChange("community")}>커뮤니티</button>
        <button onClick={() => go("friends")}>친구</button>
      </div>
      {tab === "posts" ? (
        <>
          {composerOpen && (
            <div style={{ padding: "0 20px" }}>
              <PostComposer
                galleryId={DEFAULT_GALLERY_ID}
                onCreated={() => { setComposerOpen(false); posts.refetch(); }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}
          {posts.status !== "ready" ? (
            <div role="status"><PostListStatus state={posts.status} />{posts.status === "error" && <button className="community-retry gray-pill" onClick={posts.refetch}>다시 시도</button>}</div>
          ) : posts.posts.length === 0 ? (
            <PostListStatus state="empty" />
          ) : (
            posts.posts.map((post) => (
              <CommunityPost key={post.postId} post={post} onChanged={posts.refetch} onCompose={() => setComposerOpen(true)} onComments={onComments} />
            ))
          )}
          {!composerOpen && posts.status === "ready" && <button className="community-compose purple-pill" onClick={() => setComposerOpen(true)}>글쓰기</button>}
        </>
      ) : (
        <CommunityDirectory go={go} onOpen={onOpenCommunity} />
      )}
    </div>
  );
}
export function ProfileScreen({ go }: { go: Navigate }) { return <div className="profile-view scroll-content"><button className="profile-edit-trigger" onClick={() => go("edit")} aria-label="프로필 편집"><Avatar large /></button><h1>oii_aio_iiiaii</h1><div className="stats"><span><strong>Follower</strong><small>12k</small></span><span><strong>Following</strong><small>12k</small></span><span><strong>Articles</strong><small>12k</small></span></div><div className="tags"><span>Guitar</span><span>Piano</span><span>Wa Sans</span></div><section className="description"><h2>Description</h2><p>안녕하십니까 저는 지금 SO MUHEHE 합니다 하지만 모든것이 MUHEHE할순 없겠죠<br />hahahahahahahadfsgdsfsfsadfasdfdsafasdfasdfdsafdas</p></section><section><SectionTitle>내 작업물</SectionTitle><SongRail /></section></div>; }
export function EditProfileScreen() { return <div className="edit-view scroll-content"><button className="edit-avatar" aria-label="프로필 사진 변경"><Avatar large /><span><Asset name="photo-add.svg" /></span></button><label><strong>이름</strong><input defaultValue="oii_aio_iiiaii" /></label><label><strong>악기</strong><input defaultValue="Guitar, Piano, Wa Sans" /></label><label><strong>설명</strong><textarea defaultValue={"안녕하십니까 저는 지금 SO MUHEHE 합니다 하지만 모든것이 MUHEHE할순 없겠죠\nhahahahahahahadfsgdsfsfsadfasdfdsafasdfasdfdsafdas"} /></label></div>; }

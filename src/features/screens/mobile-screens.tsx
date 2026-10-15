"use client";

import "./community.css";
import "./popular-charts.css";
import { ContentActions } from "@/features/community/admin/content-actions";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { CommunityDirectory } from "./community-directory";
import type { Community } from "./community-card";

import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Asset, Avatar, SectionTitle, SongRail } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useGalleryPosts } from "@/hooks/use-gallery-posts";
import { createPost, DEFAULT_GALLERY_ID, deletePost, fetchPost, togglePostBookmark, togglePostReaction, updatePost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { ApiError, getAccessToken } from "@/lib/api/client";
import { uploadMedia } from "@/lib/api/media";
import { useHomeSongs } from "@/hooks/use-home-songs";
import { usePopularPosts } from "@/hooks/use-popular-posts";
import { validatePostImage } from "@/features/community/post-image";
import { PopularActions } from "./popular-actions";
import { ContentShareDialog } from "@/features/screens/content-share";

function postError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403) return "이 작업을 수행할 권한이 없습니다. 계정 상태와 작성자를 확인해주세요.";
    if (error.errorCode === "GALLERY_NOT_FOUND") return "게시글을 등록할 커뮤니티를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.";
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

function MiniPost({ tall = false, post, onOpen }: { tall?: boolean; post: PostListItem; onOpen: (postId: number) => void }) {
  return (
    <button
      type="button"
      className={`mini-post ${tall ? "mini-post--tall" : ""}`}
      onClick={() => onOpen(post.postId)}
      aria-label={`${post.title} 게시글 열기`}
    >
      {post.imageUrl && (
        <span className="post-thumb">
          <Image src={post.imageUrl} alt="게시글 첨부 이미지" width={90} height={90} unoptimized />
        </span>
      )}
      <div className="mini-post-copy">
        <strong>{post.title}</strong>
        <div className="mini-meta">
          <span>{relativeTime(post.createdAt)}</span>
          <span><Asset name="like.svg" />{post.likeCount}</span>
          <span><Asset name="comment.svg" />{post.commentCount}</span>
        </div>
        <div className="mini-author"><Avatar src={post.writer.profileImageUrl} /><span>{post.writer.nickname}</span></div>
      </div>
    </button>
  );
}
function SongRailStatus({ state }: { state: "loading" | "error" | "empty" | "signed-out" }) {
  const message = state === "loading" ? "곡을 불러오는 중..."
    : state === "error" ? "곡을 불러오지 못했습니다."
      : state === "signed-out" ? "로그인하면 참여한 곡을 확인할 수 있어요."
        : "아직 표시할 곡이 없어요.";
  return <p className="song-rail-status">{message}</p>;
}

export type SongChartKind = "popular" | "mine";

export function HomeScreen({ go, onOpenPost, onOpenShort, onShowSongs }: { go: Navigate; onOpenPost: (postId: number) => void; onOpenShort: (shortId: number) => void; onShowSongs: (kind: SongChartKind) => void }) {
  const posts = usePopularPosts(3);
  const songs = useHomeSongs();
  return <div className="home-content scroll-content"><section><SectionTitle onAll={() => onShowSongs("popular")}>인기 차트</SectionTitle>{songs.popular.status !== "ready" ? <SongRailStatus state={songs.popular.status} /> : songs.popular.items.length === 0 ? <SongRailStatus state="empty" /> : <SongRail songs={songs.popular.items} onOpen={onOpenShort} />}</section><section><SectionTitle onAll={() => go("posts")}>인기 글</SectionTitle><div className="mini-post-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.map(post => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)}</div></section><section><SectionTitle onAll={() => onShowSongs("mine")}>내 곡</SectionTitle>{songs.mine.status !== "ready" ? <SongRailStatus state={songs.mine.status} /> : songs.mine.items.length === 0 ? <SongRailStatus state="empty" /> : <SongRail songs={songs.mine.items} onOpen={onOpenShort} />}</section></div>;
}
export function ChartsScreen({ go, kind, onOpenShort }: { go: Navigate; kind: SongChartKind; onOpenShort: (shortId: number) => void }) {
  const songs = useHomeSongs(100);
  const selected = kind === "popular" ? songs.popular : songs.mine;
  return <div className="list-view scroll-content popular-page"><h1 className="popular-page-title">{kind === "popular" ? "인기 차트" : "내 곡"}</h1><div className="popular-list popular-song-list">{selected.status !== "ready" ? <SongRailStatus state={selected.status} /> : selected.items.length === 0 ? <SongRailStatus state="empty" /> : selected.items.map((song, index) => {
    const composers = [...new Set([song.author.nickname, ...song.participants.map(person => person.nickname)].filter(Boolean))].join(", ");
    return <div className="popular-row popular-song-row" key={song.shortId}>
      <button type="button" className="popular-row-main" onClick={() => onOpenShort(song.shortId)} aria-label={`${kind === "popular" ? `${index + 1}위 ` : ""}${song.title} 열기`}>
        <span className="popular-art">{song.albumImageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} /> : null}{kind === "popular" && <b className="popular-rank">{index + 1}위</b>}</span>
        <span className="popular-song-copy"><strong>{song.title}</strong><small>{composers}</small></span>
      </button>
      {kind === "popular" && <PopularActions content={{ kind: "short", id: song.shortId }} />}
    </div>;
  })}</div></div>;
}
export function PostsScreen({ go, onOpenPost }: { go: Navigate; onOpenPost: (postId: number) => void }) {
  const posts = usePopularPosts(100);
  return <div className="list-view scroll-content popular-page"><h1 className="popular-page-title">인기 글</h1><div className="popular-list popular-post-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.map((post, index) => <div className="popular-row popular-post-row" key={post.postId}>
    <button type="button" className="popular-row-main" onClick={() => onOpenPost(post.postId)} aria-label={`${index + 1}위 ${post.title} 게시글 열기`}>
      <span className="popular-art">{post.imageUrl && <Image src={post.imageUrl} alt="게시글 첨부 이미지" width={90} height={90} unoptimized />}<b className="popular-rank">{index + 1}위</b></span>
      <span className="popular-post-copy"><strong>{post.title}</strong><span className="popular-post-meta"><span>{relativeTime(post.createdAt)}</span><span><Asset name="like.svg" />{post.likeCount}</span><span><Asset name="like.svg" className="thumb-down" />{post.dislikeCount}</span></span><span className="popular-post-author"><Avatar src={post.writer.profileImageUrl} />{post.writer.nickname}</span></span>
    </button>
    <PopularActions content={{ kind: "post", id: post.postId }} />
  </div>)}</div></div>;
}
export function FriendsScreen({ go }: { go: Navigate }) {
  const [following, setFollowing] = useState([false, true, true, false]);
  const [requests, setRequests] = useState([true, true]);
  return (
    <div className="friends-view">
      <section>
        <SectionTitle>팔로우 추천</SectionTitle>
        <div className="people-list">
          {following.map((on, i) => (
            <div className="person" key={i}>
              <button className="person-link" onClick={() => go("profile")}>
                <Avatar />
                <span>
                  <strong>Muhehehe</strong>
                  <small>피아노</small>
                </span>
              </button>
              <button
                className="purple-pill"
                onClick={() =>
                  setFollowing((s) => s.map((v, x) => (x === i ? !v : v)))
                }
              >
                {on ? "맞팔로우" : "팔로우"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 요청</SectionTitle>
        <div className="people-list">
          {requests.map(
            (show, i) =>
              show && (
                <div className="person" key={i}>
                  <button className="person-link" onClick={() => go("profile")}>
                    <Avatar />
                    <span>
                      <strong>Muhehehe</strong>
                      <small>피아노</small>
                    </span>
                  </button>
                  <button
                    className="purple-pill compact"
                    onClick={() =>
                      setRequests((s) => s.map((v, x) => (x === i ? false : v)))
                    }
                  >
                    확인
                  </button>
                  <button
                    className="gray-pill"
                    onClick={() =>
                      setRequests((s) => s.map((v, x) => (x === i ? false : v)))
                    }
                  >
                    취소
                  </button>
                </div>
              ),
          )}
        </div>
      </section>
    </div>
  );
}
export function SearchScreen({ go }: { go: Navigate }) { const [query, setQuery] = useState(""); return <div className="search-view"><div className="search-line"><button onClick={() => go("home")} aria-label="뒤로"><Asset name="return.svg" /></button><label><Asset name="search.svg" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}</label></div>{query && <p className="search-result">‘{query}’ 검색 결과가 없습니다.</p>}</div>; }
export function PostComposer({ galleryId, onCreated, onCancel }: { galleryId: number; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ file: File; previewUrl: string } | null>(null);

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
  }, [image]);

  function selectImage(file: File | undefined) {
    if (!file) return;
    try {
      validatePostImage(file);
      setImage({ file, previewUrl: URL.createObjectURL(file) });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "이미지를 첨부하지 못했습니다.");
    }
  }

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imageFileId = image ? await uploadMedia(image.file, "IMAGE") : null;
      await createPost(galleryId, title, content, imageFileId);
      setTitle("");
      setContent("");
      setImage(null);
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
      {image ? (
        <div className="post-image-preview">
          <Image src={image.previewUrl} alt="첨부할 게시글 이미지 미리보기" width={350} height={262} unoptimized />
          <button type="button" onClick={() => setImage(null)} disabled={submitting} aria-label="첨부 이미지 삭제">삭제</button>
        </div>
      ) : (
        <label className="post-image-picker">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={submitting}
            onChange={(event) => {
              selectImage(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <strong>사진 추가</strong>
          <span>JPG, PNG, WEBP, GIF · 최대 100MB</span>
        </label>
      )}
      {error && <p className="post-form-error">{error}</p>}
      <div className="post-form-actions">
        <button className="gray-pill compact" onClick={onCancel} disabled={submitting}>취소</button>
        <button className="purple-pill compact" onClick={submit} disabled={submitting}>{submitting ? "게시 중..." : "게시"}</button>
      </div>
    </div>
  );
}

export function CommunityPost({ post, onChanged, onCompose, onComments }: { post: PostListItem; onChanged: () => void; onCompose: () => void; onComments: (postId: number) => void }) {
  const currentUserId = useCurrentUserId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [dislikeCount, setDislikeCount] = useState(post.dislikeCount);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    fetchPost(post.postId).then(detail => {
      if (!cancelled) {
        setPreview(detail.content);
        setImageUrl(detail.imageUrl);
        setVote(detail.isLiked ? "like" : detail.isDisliked ? "dislike" : null);
        setLikeCount(detail.likeCount);
        setDislikeCount(detail.dislikeCount);
        setSaved(detail.isBookmarked);
      }
    }).catch(error => {
      if (!cancelled) setError(postError(error));
    });
    return () => { cancelled = true; };
  }, [post.postId, post.imageUrl]);

  async function readPost() {
    if (preview !== null) { setExpanded(value => !value); return; }
    setSubmitting(true);
    setError(null);
    try {
      const detail = await fetchPost(post.postId);
      setPreview(detail.content);
      setImageUrl(detail.imageUrl);
      setExpanded(true);
    } catch (error) { setError(postError(error)); }
    finally { setSubmitting(false); }
  }

  async function react(type: "like" | "dislike") {
    if (reactionBusy) return;
    setReactionBusy(true);
    setError(null);
    try {
      const result = await togglePostReaction(post.postId, type);
      setVote(result.isLiked ? "like" : result.isDisliked ? "dislike" : null);
      setLikeCount(result.likeCount);
      setDislikeCount(result.dislikeCount);
    } catch (cause) { setError(postError(cause)); }
    finally { setReactionBusy(false); }
  }

  async function bookmark() {
    if (bookmarkBusy) return;
    setBookmarkBusy(true); setError(null);
    try { setSaved((await togglePostBookmark(post.postId)).isBookmarked); }
    catch (cause) { setError(postError(cause)); }
    finally { setBookmarkBusy(false); }
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
        {/* 조회수는 목록 응답이 이미 주는 값이다 — 상세를 따로 부르지 않는다. 상세 화면(post-comments)과
            같은 "조회 N" 표기를 쓴다. 홈·인기글의 MiniPost에는 넣지 않았다: 그 카드는 열린 PR #20이
            통째로 다시 쓰는 중이라 같은 자리를 건드리면 충돌만 늘어난다. #20 머지 후에 맞춘다. */}
        <span>• 조회 {post.viewCount.toLocaleString("ko-KR")}</span>
        <button disabled={submitting} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="게시글 더보기"><Asset name="option.svg" /></button>
      </div>
      {menuOpen && <div className="post-menu-actions"><button className="gray-pill compact" onClick={onCompose}>글쓰기</button>{currentUserId === post.writer.userId && <><button className="gray-pill compact" onClick={startEdit}>수정</button><button className="gray-pill compact" onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}>삭제</button></>}<ContentActions key={currentUserId} kind="post" contentId={post.postId} onChanged={onChanged} /></div>}
      <h2><button className="post-read" disabled={submitting} onClick={readPost} aria-expanded={expanded}>{post.title}</button></h2>
      <button className={`post-preview ${expanded ? "expanded" : ""}`} onClick={readPost} disabled={submitting}>{preview ?? "로그인 후 게시글 내용을 확인할 수 있어요."}</button>
      {error && <p className="post-form-error" role="alert">{error}</p>}
      {confirmDelete && <div className="post-delete-confirm" role="group" aria-label="게시글 삭제 확인"><p>이 게시글을 삭제할까요?</p><button className="gray-pill" disabled={submitting} onClick={() => setConfirmDelete(false)}>취소</button><button className="purple-pill" disabled={submitting} onClick={remove}>{submitting ? "삭제 중..." : "삭제 확인"}</button></div>}
      {imageUrl && <Image className="community-image" src={imageUrl} alt="게시글 첨부 이미지" width={350} height={262} unoptimized />}
      <div className="community-actions">
        <div className={`community-vote${vote ? " active" : ""}`} role="group" aria-label="게시글 반응"><button className={vote === "like" ? "liked" : ""} onClick={() => react("like")} disabled={reactionBusy} aria-label={`좋아요 ${likeCount}개`} aria-pressed={vote === "like"}><Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />{likeCount}</button><span className="community-vote-divider" aria-hidden="true" /><button aria-label={`싫어요 ${dislikeCount}개`} aria-pressed={vote === "dislike"} disabled={reactionBusy} onClick={() => react("dislike")}><Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} className="thumb-down" />{dislikeCount}</button></div>
        <button onClick={() => onComments(post.postId)} aria-label={`댓글 ${post.commentCount}개 보기`}><Asset name="comment.svg" />{post.commentCount}</button>
        <i />
        <button aria-label="게시글 공유" onClick={() => setShareOpen(true)}><Asset name="share.svg" /></button>
        <button className={saved ? "active" : ""} aria-label="게시글 북마크" aria-pressed={saved} disabled={bookmarkBusy} onClick={bookmark}><Asset name={saved ? "bookmark-filled.svg" : "bookmark.svg"} /></button>
      </div>
      {shareOpen && <ContentShareDialog content={{ kind: "post", id: post.postId }} onClose={() => setShareOpen(false)} />}
    </article>
  );
}

export type CommunityTab = "posts" | "community" | "friends";

// tab은 page.tsx가 들고 있다 — "모두보기"로 전체 목록에 다녀와도 커뮤니티 탭이 유지되도록.
export function CommunityScreen({ go, tab, onTabChange, onComments, onOpenCommunity }: { go: Navigate; tab: CommunityTab; onTabChange: (tab: CommunityTab) => void; onComments: (postId: number) => void; onOpenCommunity: (community: Community) => void }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);

  return (
    <div className="community-view scroll-content">
      <div className="community-tabs" aria-label="소셜 메뉴">
        <button aria-pressed={tab === "posts"} className={tab === "posts" ? "active" : ""} onClick={() => onTabChange("posts")}>게시글</button>
        <button aria-pressed={tab === "community"} className={tab === "community" ? "active" : ""} onClick={() => onTabChange("community")}>커뮤니티</button>
        <button aria-pressed={tab === "friends"} className={tab === "friends" ? "active" : ""} onClick={() => onTabChange("friends")}>친구</button>
      </div>
      {tab === "posts" ? (
        <>
          {composerOpen ? (
            <div style={{ padding: "0 20px" }}>
              <PostComposer
                galleryId={DEFAULT_GALLERY_ID}
                onCreated={() => { setComposerOpen(false); posts.refetch(); }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          ) : posts.status !== "ready" ? (
            <div role="status"><PostListStatus state={posts.status} />{posts.status === "error" && <button className="community-retry gray-pill" onClick={posts.refetch}>다시 시도</button>}</div>
          ) : posts.posts.length === 0 ? (
            <PostListStatus state="empty" />
          ) : (
            posts.posts.map((post) => (
              <CommunityPost key={post.postId} post={post} onChanged={posts.refetch} onCompose={() => setComposerOpen(true)} onComments={onComments} />
            ))
          )}
          {!composerOpen && <button className="community-compose purple-pill" onClick={() => setComposerOpen(true)}>글쓰기</button>}
        </>
      ) : tab === "friends" ? (
        <FriendsScreen go={go} />
      ) : (
        <CommunityDirectory go={go} onOpen={onOpenCommunity} />
      )}
    </div>
  );
}

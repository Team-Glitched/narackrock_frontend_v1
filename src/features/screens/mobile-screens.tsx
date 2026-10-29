import "./community.css";
import "./opensource-discovery.css";
import { HomeWorkSection } from "@/features/workspace/home-work-section";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { PostMemberModeration, type PostModerationCommunity } from "@/features/admin/post-member-moderation";
import { canManageCommunityMember } from "@/features/admin/permissions";
import { useGalleries } from "@/hooks/use-galleries";
import { PostUserActionsMenu } from "@/components/app/dialog";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { ReportReasons } from "@/components/app/report-reasons";
import { PostActions } from "@/components/app/post-actions";
import { useSavedItems } from "@/features/saved/saved-store";
import { CommunityDirectory } from "./community-directory";
import type { Community } from "./community-card";

import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";
import { Asset, Avatar, IconSlot, SectionTitle, SongRail } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useGalleryPosts } from "@/hooks/use-gallery-posts";
import { createPost, DEFAULT_GALLERY_ID, deletePost, fetchPost, updatePost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { ApiError, getAccessToken, getCurrentUserId } from "@/lib/api/client";
import { uploadMedia } from "@/lib/api/media";
import { useHomeSongs } from "@/hooks/use-home-songs";
import { validatePostImage } from "@/features/community/post-image";

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

export function MiniPost({ tall = false, post, onOpen }: { tall?: boolean; post: PostListItem; onOpen: (postId: number) => void }) {
  const hiddenPosts = useHiddenPosts();
  const [excerpt, setExcerpt] = useState(post.title);
  useEffect(() => { let active = true; fetchPost(post.postId).then(detail => { if (active) setExcerpt(detail.content || detail.title); }).catch(() => {}); return () => { active = false; }; }, [post.postId]);
  if (hiddenPosts.ids.has(post.postId)) return null;
  return (
    <button
      type="button"
      className={`mini-post ${tall ? "mini-post--tall" : ""}`}
      data-post-id={post.postId}
      onClick={() => onOpen(post.postId)}
      aria-label={`${post.title} 게시글 열기`}
    >
      <span className="post-thumb">{post.imageUrl && <img src={post.imageUrl} alt="게시글 첨부 이미지" width={90} height={90} />}</span>
      <div className="mini-post-copy">
        <strong>{excerpt}</strong>
        <div className="mini-meta" aria-label="게시글 통계">
          <span>{relativeTime(post.createdAt)}</span>
          <span><IconSlot name="like.svg" kind="mini" />{post.likeCount}</span>
          <span><IconSlot name="mini-comment.svg" kind="mini" />{post.commentCount}</span>
        </div>
        <div className="mini-author"><Avatar src={post.writer.profileImageUrl} /><span>{post.writer.nickname}</span></div>
      </div>
    </button>
  );
}


function SongRailStatus({ state }: { state: "loading" | "error" | "empty" | "signed-out" }) {
  const message = state === "loading" ? "곡을 불러오는 중..."
    : state === "error" ? "곡을 불러오지 못했습니다."
      : state === "signed-out" ? "로그인하면 음악 목록을 확인할 수 있습니다."
        : "아직 표시할 곡이 없어요.";
  return <p className="song-rail-status">{message}</p>;
}

export type SongChartKind = "popular" | "mine" | "recommended";

export function HomeScreen({ go, onOpenPost, onOpenShort, onShowSongs, onResume }: { onResume:(projectId:number,shortId:number|null)=>void;go: Navigate; onOpenPost: (postId: number) => void; onOpenShort: (shortId: number) => void; onShowSongs: (kind: SongChartKind) => void }) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID, { sort: "POPULAR" });
  const songs = useHomeSongs();
  return <div className="home-content scroll-content"><HomeWorkSection go={go} onResume={onResume}/><section><SectionTitle onAll={() => onShowSongs("popular")}>인기 차트</SectionTitle>{songs.popular.status !== "ready" ? <SongRailStatus state={songs.popular.status} /> : songs.popular.items.length === 0 ? <SongRailStatus state="empty" /> : <SongRail songs={songs.popular.items} onOpen={onOpenShort} />}</section><section><SectionTitle onAll={() => onShowSongs("recommended")}>추천 음악</SectionTitle>{songs.recommended.status !== "ready" ? <SongRailStatus state={songs.recommended.status} /> : songs.recommended.items.length === 0 ? <SongRailStatus state="empty" /> : <SongRail songs={songs.recommended.items} onOpen={onOpenShort} />}</section><section><SectionTitle onAll={() => go("posts")}>{uiLabels.popularPosts}</SectionTitle><div className="mini-post-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.slice(0, 3).map(post => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)}</div></section><section><SectionTitle onAll={() => onShowSongs("mine")}>{uiLabels.myMusic}</SectionTitle>{songs.mine.status !== "ready" ? <SongRailStatus state={songs.mine.status} /> : songs.mine.items.length === 0 ? <SongRailStatus state="empty" /> : <SongRail songs={songs.mine.items} onOpen={onOpenShort} />}</section></div>;
}
export function ChartsScreen({ kind, onOpenShort }: { go: Navigate; kind: SongChartKind; onOpenShort: (shortId: number) => void }) {
  const songs = useHomeSongs(100);
  const selected = kind === "popular" ? songs.popular : kind === "recommended" ? songs.recommended : songs.mine;
  return <div className="list-view scroll-content"><h1 className="posts-list-title">{kind === "popular" ? "인기 차트" : kind === "recommended" ? "추천 음악" : uiLabels.myMusic}</h1><div className="chart-list">{selected.status !== "ready" ? <SongRailStatus state={selected.status} /> : selected.items.length === 0 ? <SongRailStatus state="empty" /> : selected.items.map(song => <button type="button" className="chart-row" key={song.shortId} onClick={() => onOpenShort(song.shortId)}><span className="chart-art">{song.albumImageUrl

    ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
    : <span className="empty-artwork" />}</span><span><strong>{song.title}</strong><small>{song.author.nickname}</small></span><Asset name="post-more.svg" /></button>)}</div></div>;
}
export function PostsScreen({ onOpenPost }: { go: Navigate; onOpenPost: (postId: number) => void }) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID, { sort: "POPULAR" });
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinel = useInfiniteScroll({ rootRef, enabled: posts.hasMore && !posts.appending && !posts.appendFailed, onLoadMore: posts.loadMore });
  return <div ref={rootRef} className="list-view scroll-content"><h1 className="posts-list-title">{uiLabels.popularPosts}</h1><div className="posts-list">{posts.status !== "ready" ? <PostListStatus state={posts.status} /> : posts.posts.length === 0 ? <PostListStatus state="empty" /> : posts.posts.map(post => <MiniPost tall key={post.postId} post={post} onOpen={onOpenPost} />)}</div>{posts.hasMore && <div ref={sentinel} className="post-feed-sentinel" aria-hidden="true" />}{posts.appendFailed && <button onClick={posts.loadMore}>다시 시도</button>}</div>;
}
export function FriendsScreen({ go }: { go: Navigate }) {
  const [following, setFollowing] = useState([false, true, true, false]);
  const [requests, setRequests] = useState([true, true]);
  return (
    <div className="friends-view scroll-content">
      <section className="mutual-friends"><SectionTitle>맞팔로우</SectionTitle><div className="mutual-friend-rail">{[0,1,2,3].map(id => <article className="mutual-friend-card" key={id}><button className="mutual-friend-identity" aria-label="Muhehehe 프로필" onClick={() => go("profile", 3)}><Avatar /><strong>Muhehehe</strong><small>피아노</small></button><button className="purple-pill" onClick={() => go("chat")}>채팅</button></article>)}</div></section>
      <section>
        <SectionTitle>팔로우 추천</SectionTitle>
        <div className="people-list">
          {following.map((on, i) => (
            <div className="person" key={i}>
              <button className="person-link" onClick={() => go("profile", 3)}>
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
                  <button className="person-link" onClick={() => go("profile", 3)}>
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
          <img src={image.previewUrl} alt="첨부할 게시글 이미지 미리보기" width={350} height={262} />
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

export function CommunityPost({ post, onChanged, onComments, onProfile, onModerateDelete, moderationCommunity, postGalleryId }: { postGalleryId?:number;moderationCommunity?:PostModerationCommunity; onModerateDelete?: (postId:number)=>Promise<void>; post: PostListItem; onChanged: () => void; onComments: (postId: number) => void; onProfile?: (userId: number) => void }) {
  const currentUserId=getCurrentUserId();
  const owner = currentUserId === post.writer.userId;
  const canModerateMember=Boolean(moderationCommunity&&moderationCommunity.galleryId===postGalleryId&&canManageCommunityMember(moderationCommunity,currentUserId,post.writer.userId));
  const [memberAction,setMemberAction]=useState<"suspend"|"expel"|null>(null);
  const [moderationNotice,setModerationNotice]=useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const optionButton=useRef<HTMLButtonElement>(null);
  const hiddenPosts = useHiddenPosts();
  const [reportOpen,setReportOpen]=useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const savedItems = useSavedItems();
  const saved = savedItems.has("post", post.postId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    fetchPost(post.postId).then(detail => {
      if (!cancelled) {
        setPreview(detail.content);
        setImageUrl(detail.imageUrl);
      }
    }).catch(error => {
      if (!cancelled) setError(postError(error));
    });
    return () => { cancelled = true; };
  }, [post.postId, post.imageUrl]);

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
      if(onModerateDelete) await onModerateDelete(post.postId);
      else await deletePost(post.postId);
      onChanged();
    } catch (error) {
      setError(postError(error));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  }

  if (hiddenPosts.ids.has(post.postId)) return null;

  if (editing) {
    return (
      <article className="community-post" data-post-id={post.postId}>
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
    <article className="community-post" data-post-id={post.postId}>
      <div className="community-author">
        <button className="post-author-link" aria-label={`${post.writer.nickname} 프로필`} onClick={() => onProfile?.(post.writer.userId)}><Avatar src={post.writer.profileImageUrl} /><strong>{post.writer.nickname || "알 수 없는 사용자"}</strong></button>
        <span>• {relativeTime(post.createdAt)}</span>
        <button ref={optionButton} disabled={submitting} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="게시글 더보기"><Asset name="post-more.svg" /></button>
      </div>
      {menuOpen && (!owner || onModerateDelete) && <PostUserActionsMenu onSuspendMember={canModerateMember?()=>{setMenuOpen(false);setMemberAction("suspend");}:undefined} onExpelMember={canModerateMember?()=>{setMenuOpen(false);setMemberAction("expel");}:undefined} onModerateDelete={onModerateDelete?()=>{setConfirmDelete(true);setMenuOpen(false);}:undefined} anchorRef={optionButton} onClose={()=>setMenuOpen(false)} onReport={()=>{setMenuOpen(false);setReportOpen(true);}} onHide={()=>{setMenuOpen(false);hiddenPosts.hide(post.postId);}}/>}
      {memberAction&&moderationCommunity&&<PostMemberModeration community={moderationCommunity} member={post.writer} action={memberAction} onClose={()=>setMemberAction(null)} onDone={message=>{setMemberAction(null);setModerationNotice(message);}}/>}
      {moderationNotice&&<p className="post-moderation-notice" role="status">{moderationNotice}</p>}
      {reportOpen && <FigmaSheet title="신고" onClose={()=>setReportOpen(false)}><ReportReasons/></FigmaSheet>}
      {menuOpen && owner && !onModerateDelete && <PostUserActionsMenu anchorRef={optionButton} onClose={()=>setMenuOpen(false)} onReport={()=>{}} onHide={()=>{}} onEdit={startEdit} onDelete={()=>{setConfirmDelete(true);setMenuOpen(false);}}/>}
      <h2><button className="post-read" disabled={submitting} onClick={() => onComments(post.postId)}>{post.title}</button></h2>
      {preview !== "" && <button className="post-preview" onClick={() => onComments(post.postId)} disabled={submitting}>{preview ?? "로그인 후 게시글 내용을 확인할 수 있어요."}</button>}
      {error && <p className="post-form-error" role="alert">{error}</p>}
      {confirmDelete && <div className="post-delete-confirm" role="group" aria-label="게시글 삭제 확인"><p>이 게시글을 삭제할까요?</p><button className="gray-pill" disabled={submitting} onClick={() => setConfirmDelete(false)}>취소</button><button className="purple-pill" disabled={submitting} onClick={remove}>{submitting ? "삭제 중..." : "삭제 확인"}</button></div>}
      {imageUrl && <button className="post-image-open" aria-label={`${post.title} 게시글 열기`} onClick={() => onComments(post.postId)}><img className="community-image" src={imageUrl} alt="게시글 첨부 이미지" width={350} height={262} /></button>}
      <PostActions likeCount={post.likeCount} commentCount={post.commentCount} vote={vote} onVote={next=>setVote(current=>current===next?null:next)} onComments={()=>onComments(post.postId)} saved={saved} onSave={()=>{try {savedItems.toggle({id:post.postId,kind:"post",title:preview??post.title,author:post.writer.nickname,imageUrl:post.imageUrl});}catch(cause){setError(cause instanceof Error?cause.message:"저장하지 못했습니다.");}}}/>

    </article>
  );
}

export type CommunityTab = "posts" | "community" | "friends";

// tab은 page.tsx가 들고 있다 — "모두보기"로 전체 목록에 다녀와도 커뮤니티 탭이 유지되도록.
export function CommunityScreen({ go, tab, onTabChange, onComments, onOpenCommunity }: { go: Navigate; tab: CommunityTab; onTabChange: (tab: CommunityTab) => void; onComments: (postId: number) => void; onOpenCommunity: (community: Community) => void }) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);
  const galleries=useGalleries(0);

  return (
    <div className="community-view social-screen">
      <div className="community-tabs" aria-label="소셜 메뉴">
        <button aria-pressed={tab === "posts"} className={tab === "posts" ? "active" : ""} onClick={() => onTabChange("posts")}>게시글</button>
        <button aria-pressed={tab === "community"} className={tab === "community" ? "active" : ""} onClick={() => onTabChange("community")}>커뮤니티</button>
        <button aria-pressed={tab === "friends"} className={tab === "friends" ? "active" : ""} onClick={() => onTabChange("friends")}>친구</button>
      </div>
      {tab === "posts" ? (
        <div className="social-post-feed scroll-content">
          {posts.status !== "ready" ? (
            <div role="status"><PostListStatus state={posts.status} />{posts.status === "error" && <button className="community-retry gray-pill" onClick={posts.refetch}>다시 시도</button>}</div>
          ) : posts.posts.length === 0 ? (
            <PostListStatus state="empty" />
          ) : (
            posts.posts.map((post) => (
              <CommunityPost key={post.postId} post={post} postGalleryId={DEFAULT_GALLERY_ID} moderationCommunity={galleries.status==="ready"?galleries.galleries.find(gallery=>gallery.galleryId===DEFAULT_GALLERY_ID):undefined} onChanged={posts.refetch} onProfile={id => go("profile", id)} onComments={onComments} />
            ))
          )}

        </div>
      ) : tab === "friends" ? (
        <FriendsScreen go={go} />
      ) : (
        <CommunityDirectory go={go} onOpen={onOpenCommunity} />
      )}
    </div>
  );
}

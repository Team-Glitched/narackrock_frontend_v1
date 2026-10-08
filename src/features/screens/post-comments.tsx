"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Asset, Avatar } from "@/components/app/shared";
import { createPostComment, deletePostComment, fetchPost, fetchPostComments, recordPostView, updatePostComment } from "@/lib/api/community";
import { ApiError, getCurrentUserId } from "@/lib/api/client";
import type { PostComment, PostCommentPage, PostDetailResponse } from "@/lib/api/contracts";
import "./community.css";
import "./post-comments.css";

function errorMessage(error: unknown, forbidden = "현재 계정은 댓글을 작성할 수 없습니다.") {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요하거나 만료되었습니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403) return forbidden;
    if (error.status === 404) return "게시글 또는 댓글이 삭제되었거나 존재하지 않습니다.";
    if (error.status === 400) return "댓글 내용과 입력값을 확인해주세요.";
  }
  return "불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

// 서버가 NOT_COMMENT_OWNER / BANNED_USER_ACCESS 를 모두 403으로 내려주는데
// client.ts가 errorCode를 파싱하지 않아 상태 코드만으로는 구분할 수 없다.
const FORBIDDEN_OWN_COMMENT = "본인이 작성한 댓글만 수정·삭제할 수 있어요. 계정 정지 상태도 확인해주세요.";

// 로그인 사용자 id를 모르면(아직 로그인 화면이 없다) 일단 노출하고 서버 403으로 거른다.
// 로그인이 붙으면 자동으로 본인 댓글에만 보이게 좁혀진다.
function canManage(writerId: number): boolean {
  const me = getCurrentUserId();
  return me === null || me === writerId;
}
function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNow(date, { addSuffix: true, locale: ko });
}
type ReplyTarget = { commentId: number; nickname: string };
type ThreadProps = { postId: number; parentId: number | null; revision: number; onReply: (target: ReplyTarget) => void; onChanged: () => void; depth?: number };

function CommentThread({ postId, parentId, revision, onReply, onChanged, depth = 0 }: ThreadProps) {
  const [result, setResult] = useState<PostCommentPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    fetchPostComments(postId, parentId).then(data => {
      if (current === generation.current) { setResult(data); setError(null); setBusy(false); }
    }).catch(error => {
      if (current === generation.current) { setError(errorMessage(error)); setBusy(false); }
    });
    return () => { generation.current = current + 1; };
  }, [postId, parentId, revision, retry]);

  async function more() {
    if (!result || busy) return;
    setBusy(true);
    setError(null);
    const current = generation.current;
    try {
      const next = await fetchPostComments(postId, parentId, result.page + 1);
      if (current === generation.current) setResult({ ...next, comments: [...result.comments, ...next.comments.filter(c => !result.comments.some(old => old.commentId === c.commentId))] });
    } catch (error) { if (current === generation.current) setError(errorMessage(error)); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <div className="comment-thread">
    {!result && !error && <p role="status">댓글을 불러오는 중...</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry(v => v + 1)}>다시 시도</button></div>}
    {result?.comments.length === 0 && <p className="comments-empty">{parentId === null ? "첫 댓글을 남겨보세요." : "아직 답글이 없어요."}</p>}
    {result?.comments.map(comment => <CommentRow key={comment.commentId} comment={comment} postId={postId} revision={revision} onReply={onReply} onChanged={onChanged} depth={depth} />)}
    {result && result.comments.length < result.totalCount && <button className="comments-more" disabled={busy} onClick={more}>{busy ? "불러오는 중..." : "댓글 더보기"}</button>}
  </div>;
}

function CommentRow({ comment, postId, revision, onReply, onChanged, depth }: { comment: PostComment; postId: number; revision: number; onReply: (target: ReplyTarget) => void; onChanged: () => void; depth: number }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nickname = comment.writer.nickname || "알 수 없는 사용자";
  const manageable = canManage(comment.writer.userId);

  function startEdit() {
    setMenuOpen(false);
    setConfirmDelete(false);
    setError(null);
    setDraft(comment.content);
    setEditing(true);
  }

  async function saveEdit() {
    if (!draft.trim()) { setError("댓글 내용을 입력해주세요."); return; }
    if (draft.trim() === comment.content) { setEditing(false); return; }
    setBusy(true);
    setError(null);
    try {
      await updatePostComment(comment.commentId, draft.trim());
      setEditing(false);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure, FORBIDDEN_OWN_COMMENT));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      // 성공하면 목록을 다시 불러오면서 이 행이 사라지므로 busy를 되돌리지 않는다.
      await deletePostComment(comment.commentId);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure, FORBIDDEN_OWN_COMMENT));
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return <article className="comment-row">
    <div className="comment-author">
      <Avatar src={comment.writer.profileImageUrl} /><strong>{nickname}</strong><span>• {time(comment.createdAt)}</span>
      {manageable && !editing && <button className="comment-menu-trigger" disabled={busy} aria-expanded={menuOpen} aria-label={`${nickname}의 댓글 더보기`} onClick={() => setMenuOpen(v => !v)}><Asset name="option.svg" /></button>}
    </div>
    {menuOpen && !editing && <div className="comment-menu">
      <button className="gray-pill compact" disabled={busy} onClick={startEdit}>수정</button>
      <button className="gray-pill compact" disabled={busy} onClick={() => { setMenuOpen(false); setError(null); setConfirmDelete(true); }}>삭제</button>
    </div>}

    {editing
      ? <div className="comment-edit">
          <textarea aria-label="댓글 내용 수정" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} rows={2} />
          <div className="comment-edit-actions">
            <button className="gray-pill compact" disabled={busy} onClick={() => { setEditing(false); setError(null); }}>취소</button>
            <button className="purple-pill compact" disabled={busy} onClick={saveEdit}>{busy ? "저장 중..." : "저장"}</button>
          </div>
        </div>
      : <p className="comment-content">{comment.content}</p>}

    {confirmDelete && <div className="comment-delete-confirm" role="group" aria-label="댓글 삭제 확인">
      <p>이 댓글을 삭제할까요?</p>
      <button className="gray-pill compact" disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button>
      <button className="purple-pill compact" disabled={busy} onClick={remove}>{busy ? "삭제 중..." : "삭제 확인"}</button>
    </div>}
    {error && <p className="comment-error" role="alert">{error}</p>}

    {!editing && <div className="comment-actions">
      {comment.replyCount > 0 && <button className="reply-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "답글 접기" : `답글 ${comment.replyCount}개`}</button>}
      <button aria-label={`${nickname}에게 답글 작성`} onClick={() => { setOpen(true); onReply({ commentId: comment.commentId, nickname }); }}><Asset name="comment.svg" /></button>
      <button disabled aria-label="댓글 좋아요 준비 중"><Asset name="like.svg" /></button>
      <button disabled aria-label="댓글 싫어요 준비 중"><Asset name="like.svg" className="thumb-down" /></button>
    </div>}
    {open && <div className={depth < 2 ? "comment-replies" : "comment-replies shallow"}><CommentThread postId={postId} parentId={comment.commentId} revision={revision} onReply={onReply} onChanged={onChanged} depth={depth + 1} /></div>}
  </article>;
}

export function PostCommentsScreen({ postId }: { postId: number }) {
  const [post, setPost] = useState<PostDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const comments = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPost(postId).then(data => { if (!cancelled) { setPost(data); setError(null); } })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [postId, revision]);

  // 조회수는 **본문을 실제로 띄운 뒤에만** 기록한다.
  //
  // 화면에 들어오자마자 기록하면 상세 조회가 실패한 경우까지 집계된다. 이 화면은 인증이
  // 필수라(비로그인은 401) 로그인 전에는 본문이 뜨지 않는데, 그때도 조회수가 오르는 것을
  // 실제로 확인했다. 읽지 못한 글은 읽은 것이 아니다.
  //
  // revision(댓글 등록 후 재조회)에는 의존하지 않는다 - 같은 글을 계속 보고 있을 뿐이다.
  const loadedPostId = post?.postId;
  useEffect(() => {
    if (loadedPostId !== postId) return;
    // 조회수는 본문을 읽는 데 곁다리다. 결과를 쓰지 않고 실패해도 화면에 에러를 띄우지 않는다.
    void recordPostView(postId).catch(() => {});
  }, [postId, loadedPostId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!content.trim()) { setWriteError("댓글 내용을 입력해주세요."); return; }
    setSubmitting(true); setWriteError(null); setNotice("");
    try {
      await createPostComment(postId, content.trim(), reply?.commentId ?? null);
      setContent(""); setReply(null); setRevision(v => v + 1);
      setNotice("댓글을 등록했습니다.");
    } catch (error) { setWriteError(errorMessage(error)); }
    finally { setSubmitting(false); }
  }
  return <div className="comments-screen community-view">
    <div className="comments-scroll scroll-content">
      {error && <div className="comments-error" role="alert"><p>{error}</p><button onClick={() => setRevision(v => v + 1)}>다시 시도</button></div>}
      {!post && !error && <p className="comments-error" role="status">게시글을 불러오는 중...</p>}
      {post && <>
        <article className="community-post comments-post">
          <div className="community-author"><Avatar src={post.writer.profileImageUrl} /><strong>{post.writer.nickname || "알 수 없는 사용자"}</strong><span>• {time(post.createdAt)}</span><span>• 조회 {post.viewCount.toLocaleString("ko-KR")}</span></div>
          <h2>{post.title}</h2><p className="comments-post-content">{post.content}</p>
          {post.imageUrl && <Image className="community-image" src={post.imageUrl} alt="게시글 첨부 이미지" width={350} height={262} unoptimized />}
          <div className="community-actions">
            <div className="community-vote"><button disabled aria-label="게시글 좋아요 준비 중"><Asset name="like.svg" />{post.likeCount}</button><span /><button disabled aria-label="게시글 싫어요 준비 중"><Asset name="like.svg" className="thumb-down" /></button></div>
            <button aria-label={`댓글 ${post.commentCount}개로 이동`} onClick={() => comments.current?.scrollIntoView({ block: "start" })}><Asset name="comment.svg" />{post.commentCount}</button><i />
            <button disabled aria-label="공유 준비 중"><Asset name="share.svg" /></button><button disabled aria-label="북마크 준비 중"><Asset name="bookmark.svg" /></button>
          </div>
        </article>
        <section ref={comments} className="post-comment-list" aria-label="댓글 목록"><CommentThread postId={postId} parentId={null} revision={revision} onReply={target => { setReply(target); input.current?.focus(); }} onChanged={() => { setNotice(""); setRevision(v => v + 1); }} /></section>
      </>}
    </div>
    <form className="comment-composer" onSubmit={submit}>
      {reply && <div className="reply-target">{reply.nickname}에게 답글 <button type="button" disabled={submitting} onClick={() => setReply(null)}>취소</button></div>}
      {writeError && <p role="alert">{writeError}</p>}{notice && <p role="status">{notice}</p>}
      <div className="comment-input-row"><textarea ref={input} aria-label="댓글 내용" placeholder="댓글을 남겨보세요" value={content} onChange={event => setContent(event.target.value)} disabled={submitting || !post} rows={1} /><button type="submit" disabled={submitting || !post}>{submitting ? "등록 중" : "등록"}</button></div>
    </form>
  </div>;
}

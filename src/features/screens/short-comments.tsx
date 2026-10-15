"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Asset, Avatar } from "@/components/app/shared";
import { getCurrentUserId } from "@/lib/api/client";
import { createShortComment, deleteShortComment, getShortComments, toggleShortCommentReaction, updateShortComment } from "@/lib/api/shorts";
import type { ShortComment } from "@/lib/api/contracts";
import "./short-comments.css";

type ReplyTarget = { parentId: number; nickname: string };

export function ShortCommentsSheet({ shortId, onClose, onCountChange }: { shortId: number; onClose: () => void; onCountChange: (delta: number) => void }) {
  const [comments, setComments] = useState<ShortComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getShortComments(shortId).then(result => {
      if (alive) { setComments(result.comments); setLoading(false); setError(null); }
    }).catch(cause => {
      if (alive) { setError(cause instanceof Error ? cause.message : "댓글을 불러오지 못했습니다."); setLoading(false); }
    });
    return () => { alive = false; };
  }, [shortId, revision]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const roots = useMemo(() => comments.filter(comment => comment.parentCommentId === null), [comments]);
  const repliesByParent = useMemo(() => {
    const result = new Map<number, ShortComment[]>();
    for (const comment of comments) {
      if (comment.parentCommentId === null) continue;
      const replies = result.get(comment.parentCommentId) ?? [];
      replies.push(comment);
      result.set(comment.parentCommentId, replies);
    }
    return result;
  }, [comments]);

  function reload() { setLoading(true); setRevision(value => value + 1); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true); setError(null);
    try {
      await createShortComment(shortId, draft.trim(), reply?.parentId ?? null);
      setDraft(""); setReply(null); onCountChange(1); reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "댓글을 등록하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function react(commentId: number, type: "like" | "dislike") {
    try {
      const result = await toggleShortCommentReaction(shortId, commentId, type);
      setComments(items => items.map(item => item.commentId !== commentId ? item : {
        ...item,
        isLiked: type === "like" ? Boolean(result.isLiked) : false,
        isDisliked: type === "dislike" ? Boolean(result.isDisliked) : false,
        likeCount: type === "like" ? result.likeCount ?? item.likeCount : Math.max(0, item.likeCount - (item.isLiked ? 1 : 0)),
        dislikeCount: type === "dislike" ? result.dislikeCount ?? item.dislikeCount : Math.max(0, item.dislikeCount - (item.isDisliked ? 1 : 0)),
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "댓글 반응을 저장하지 못했습니다."); }
  }

  async function edit(commentId: number, content: string) {
    await updateShortComment(shortId, commentId, content);
    reload();
  }

  async function remove(commentId: number) {
    const removed = comments.find(item => item.commentId === commentId);
    await deleteShortComment(shortId, commentId);
    onCountChange(-1 - (removed?.parentCommentId === null ? removed.replyCount : 0));
    reload();
  }

  const container = document.querySelector(".phone-frame") ?? document.body;
  return createPortal(<div className="short-comments-layer">
    <button className="short-comments-backdrop" aria-label="댓글 닫기" onClick={onClose} />
    <section className="short-comments-sheet" role="dialog" aria-modal="true" aria-label="숏폼 댓글">
      <button className="short-comments-handle" aria-label="댓글 닫기" onClick={onClose}><span /></button>
      <div className="short-comments-list">
        {loading && <p className="short-comments-state" role="status">댓글을 불러오는 중...</p>}
        {!loading && roots.length === 0 && <p className="short-comments-state">첫 댓글을 남겨보세요.</p>}
        {!loading && roots.map(root => <div className="short-comment-group" key={root.commentId}>
          <ShortCommentRow comment={root} rootId={root.commentId} onReply={setReply} onReact={react} onEdit={edit} onDelete={remove} />
          {(repliesByParent.get(root.commentId) ?? []).map(child => <div className="short-comment-reply" key={child.commentId}>
            <ShortCommentRow comment={child} rootId={root.commentId} onReply={setReply} onReact={react} onEdit={edit} onDelete={remove} />
          </div>)}
        </div>)}
      </div>
      <form className="short-comments-composer" onSubmit={submit}>
        {reply && <div className="short-comments-target">{reply.nickname}에게 답글 <button type="button" onClick={() => setReply(null)}>취소</button></div>}
        {error && <p role="alert">{error} <button type="button" onClick={reload}>다시 시도</button></p>}
        <div><textarea aria-label="숏폼 댓글 내용" placeholder="댓글을 남겨보세요" rows={1} value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} /><button type="submit" disabled={busy || !draft.trim()}>{busy ? "등록 중" : "등록"}</button></div>
      </form>
    </section>
  </div>, container);
}

function ShortCommentRow({ comment, rootId, onReply, onReact, onEdit, onDelete }: {
  comment: ShortComment;
  rootId: number;
  onReply: (target: ReplyTarget) => void;
  onReact: (commentId: number, type: "like" | "dislike") => void;
  onEdit: (commentId: number, content: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const own = getCurrentUserId() === comment.writer.userId;
  const created = new Date(comment.createdAt);
  const time = Number.isNaN(created.getTime()) ? "" : formatDistanceToNow(created, { addSuffix: true, locale: ko });

  async function save() {
    if (!draft.trim()) { setError("댓글 내용을 입력해주세요."); return; }
    setBusy(true); setError(null);
    try { await onEdit(comment.commentId, draft.trim()); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "댓글을 수정하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError(null);
    try { await onDelete(comment.commentId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "댓글을 삭제하지 못했습니다."); setBusy(false); }
  }

  return <article className="short-comment-row">
    <div className="short-comment-author"><Avatar src={comment.writer.profileImageUrl} /><span>{comment.writer.nickname || "알 수 없는 사용자"} · {time}</span>
      {own && <button aria-label="댓글 더보기" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Asset name="option.svg" /></button>}
    </div>
    {menuOpen && own && <div className="short-comment-menu"><button onClick={() => { setDraft(comment.content); setEditing(true); setMenuOpen(false); }}>수정</button><button onClick={remove} disabled={busy}>삭제</button></div>}
    {editing ? <div className="short-comment-edit"><textarea aria-label="댓글 수정" value={draft} onChange={event => setDraft(event.target.value)} /><button onClick={() => setEditing(false)}>취소</button><button onClick={save} disabled={busy}>저장</button></div> : <p>{comment.content}</p>}
    {error && <p role="alert" className="short-comment-error">{error}</p>}
    <div className="short-comment-actions">
      <button aria-label="댓글 좋아요" aria-pressed={comment.isLiked} onClick={() => onReact(comment.commentId, "like")}><Asset name={comment.isLiked ? "like-filled.svg" : "like.svg"} />{comment.likeCount}</button>
      <button aria-label="댓글 싫어요" aria-pressed={comment.isDisliked} onClick={() => onReact(comment.commentId, "dislike")}><Asset name={comment.isDisliked ? "like-filled.svg" : "like.svg"} className="thumb-down" /></button>
      <button aria-label="답글 작성" onClick={() => onReply({ parentId: rootId, nickname: comment.writer.nickname })}><Asset name="comment.svg" /></button>
    </div>
  </article>;
}

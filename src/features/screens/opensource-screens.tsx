"use client";

import { useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";

// UI sample screens from PR #21; interactions remain local until an API is connected.
export function OpensourceScreen({ go }: { go: Navigate }) {
  return (
    <div className="opensource-view scroll-content">
      {[0, 1, 2, 3, 4].map((i) => (
        <OpensourcePart
          key={i}
          onOpen={() => go("opensourceDetail")}
          onProfile={() => go("profile")}
          onComments={() => go("opensourceComments")}
        />
      ))}
    </div>
  );
}
function OpensourcePart({
  onOpen,
  onProfile,
  onComments,
}: {
  onOpen?: () => void;
  onProfile?: () => void;
  onComments?: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  return (
    <article className="os-card">
      <div className="os-head">
        <button className="os-author" onClick={onOpen} aria-label="오픈소스 글 보기">
          <Avatar />
          <span>
            <strong>개쩌는 파트</strong>
            <small>사용 수 123123</small>
          </span>
        </button>
        <button
          className="purple-pill os-save-button"
          aria-pressed={saved}
          onClick={() => setSaved((v) => !v)}
        >
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      <button className="os-body" onClick={onOpen}>
        제가 만들다 보니까 쫌 개쩔게 나와서 한번 올려봅니당
      </button>
      <div className="os-foot">
        <button className="os-foot-author" onClick={onProfile}>
          <Avatar />
          <span>min chong</span>
        </button>
        <div className="os-reactions">
          <button
            className={vote === "like" ? "voted" : ""}
            aria-label="좋아요"
            aria-pressed={vote === "like"}
            onClick={() => setVote((c) => (c === "like" ? null : "like"))}
          >
            <Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />5
          </button>
          <button
            className={`os-dislike${vote === "dislike" ? " voted" : ""}`}
            aria-label="싫어요"
            aria-pressed={vote === "dislike"}
            onClick={() => setVote((c) => (c === "dislike" ? null : "dislike"))}
          >
            <Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} />
          </button>
          <button aria-label="댓글" onClick={onComments}>
            <Asset name="comment.svg" />5
          </button>
        </div>
      </div>
    </article>
  );
}

type OsDetailCommentData = {
  id: number;
  parentId?: number;
  author: string;
  time: string;
  text: string;
  likes: number;
  vote: "like" | "dislike" | null;
};

const initialOsComments: OsDetailCommentData[] = [
  { id: 1, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 2, parentId: 1, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 3, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 4, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
];

const OS_REPLIES_PAGE = 10;

function OpensourceComment({
  comment,
  reply = false,
  canReply = true,
  menuOpen,
  onMenu,
  onReply,
  onVote,
  onReport,
}: {
  comment: OsDetailCommentData;
  reply?: boolean;
  canReply?: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onReply: () => void;
  onVote: (vote: "like" | "dislike") => void;
  onReport: () => void;
}) {
  return (
    <article className={reply ? "os-detail-comment reply" : "os-detail-comment"}>
      <div className="os-detail-comment-head">
        <Avatar />
        <span className="os-detail-comment-meta"><strong>{comment.author}</strong><small>• {comment.time}</small></span>
        <button aria-label="댓글 옵션" onClick={onMenu}><Asset name="option.svg" /></button>
        {menuOpen && <button className="os-detail-report" onClick={onReport}>신고</button>}
      </div>
      {canReply ? (
        <button className="os-detail-comment-text" onClick={onReply}>{comment.text}</button>
      ) : (
        <p className="os-detail-comment-text">{comment.text}</p>
      )}
      <div className="os-detail-comment-actions">
        {canReply && <button aria-label="답글" onClick={onReply}><Asset name="comment.svg" /></button>}
        <button
          className={comment.vote === "like" ? "active" : ""}
          aria-label="댓글 좋아요"
          aria-pressed={comment.vote === "like"}
          onClick={() => onVote("like")}
        ><Asset name={comment.vote === "like" ? "like-filled.svg" : "like.svg"} />{comment.likes}</button>
        <button
          className={comment.vote === "dislike" ? "active dislike" : "dislike"}
          aria-label="댓글 싫어요"
          aria-pressed={comment.vote === "dislike"}
          onClick={() => onVote("dislike")}
        ><Asset name={comment.vote === "dislike" ? "like-filled.svg" : "like.svg"} /></button>
      </div>
    </article>
  );
}

function OpensourceCommentThread({
  comment,
  replies,
  menuId,
  onMenu,
  onReply,
  onVote,
  onReport,
}: {
  comment: OsDetailCommentData;
  replies: OsDetailCommentData[];
  menuId: number | null;
  onMenu: (id: number) => void;
  onReply: (comment: OsDetailCommentData) => void;
  onVote: (id: number, vote: "like" | "dislike") => void;
  onReport: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [visible, setVisible] = useState(OS_REPLIES_PAGE);
  const shownReplies = replies.slice(0, visible);

  return (
    <div className="os-detail-comment-thread">
      <OpensourceComment
        comment={comment}
        menuOpen={menuId === comment.id}
        onMenu={() => onMenu(comment.id)}
        onReply={() => onReply(comment)}
        onVote={(next) => onVote(comment.id, next)}
        onReport={() => onReport(comment.id)}
      />
      {replies.length > 0 && collapsed && (
        <button
          className="abyss-replies-toggle"
          onClick={() => setCollapsed(false)}
        >
          답글 {replies.length}개
        </button>
      )}
      {replies.length > 0 && !collapsed && (
        <div className="abyss-comment-replies">
          <button
            className="abyss-replies-bar"
            aria-label="답글 접기"
            onClick={() => setCollapsed(true)}
          />
          <div className="abyss-replies-body">
            {shownReplies.map((reply) => (
              <OpensourceComment
                key={reply.id}
                comment={reply}
                reply
                canReply={false}
                menuOpen={menuId === reply.id}
                onMenu={() => onMenu(reply.id)}
                onReply={() => undefined}
                onVote={(next) => onVote(reply.id, next)}
                onReport={() => onReport(reply.id)}
              />
            ))}
            {replies.length > visible && (
              <button
                className="abyss-replies-more"
                onClick={() => setVisible((current) => current + OS_REPLIES_PAGE)}
              >
                더보기 ({replies.length - visible})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OpensourceDetailScreen({
  focusComments = false,
}: {
  focusComments?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [comments, setComments] = useState(initialOsComments);
  const [replyTo, setReplyTo] = useState<OsDetailCommentData | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const commentsRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  const focusCommentComposer = (behavior: ScrollBehavior = "smooth") => {
    setReplyTo(null);
    commentsRef.current?.scrollIntoView({ behavior, block: "start" });
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  useEffect(() => {
    if (!focusComments) return;
    const frame = requestAnimationFrame(() => focusCommentComposer("auto"));
    return () => cancelAnimationFrame(frame);
  }, [focusComments]);

  const toggleCommentVote = (id: number, next: "like" | "dislike") => {
    setComments((items) => items.map((comment) => {
      if (comment.id !== id) return comment;
      const vote = comment.vote === next ? null : next;
      const likes = comment.likes + (vote === "like" ? 1 : 0) - (comment.vote === "like" ? 1 : 0);
      return { ...comment, vote, likes };
    }));
  };
  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((items) => [...items, {
      id: Date.now(),
      parentId: replyTo?.parentId ?? replyTo?.id,
      author: "나",
      time: "방금",
      text,
      likes: 0,
      vote: null,
    }]);
    setDraft("");
    setReplyTo(null);
  };
  return (
    <div className="opensource-detail-shell">
      <div className="opensource-detail scroll-content">
        <section className="os-detail-article">
        <div className="os-detail-title-row">
          <div className="os-detail-title">
            <Avatar />
            <span><strong>개쩌는 파트</strong><small>사용 수 123123</small></span>
          </div>
          <button
            className="purple-pill os-save-button"
            aria-pressed={saved}
            onClick={() => setSaved((current) => !current)}
          >{saved ? "저장됨" : "저장"}</button>
        </div>
        <div className="os-detail-byline"><Avatar /><span>min chong · 2026.03.18</span></div>
        <p className="os-detail-copy">제가 만들다 보니까 쫌 개쩔게 나와서 한번 올려봅니당</p>
        <div className="os-audio-player">
          <button
            className="os-audio-play-toggle"
            aria-label={playing ? "일시정지" : "재생"}
            aria-pressed={playing}
            onClick={() => setPlaying((current) => !current)}
          >
            <Asset name="play.svg" />
            <span>{playing ? "0:01" : "0:00"} / 0:02</span>
            <i><b style={{ width: playing ? "58%" : "28%" }} /></i>
          </button>
          <button
            className="os-audio-mute"
            aria-label={muted ? "소리 켜기" : "무음"}
            aria-pressed={muted}
            title={muted ? "소리 켜기" : "소리 끄기"}
            onClick={() => setMuted((current) => !current)}
          >
            <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
          </button>
        </div>
        <div className="os-detail-reactions">
          <div className={`os-detail-vote${vote ? " active" : ""}`}>
            <button
              aria-label="좋아요"
              aria-pressed={vote === "like"}
              onClick={() => setVote((current) => current === "like" ? null : "like")}
            ><Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />116</button>
            <i />
            <button
              className="dislike"
              aria-label="싫어요"
              aria-pressed={vote === "dislike"}
              onClick={() => setVote((current) => current === "dislike" ? null : "dislike")}
            ><Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} /></button>
          </div>
          <button className="os-detail-comment-count" onClick={() => focusCommentComposer()}><Asset name="comment.svg" />116</button>
          <span />
          <button className="os-detail-share" aria-label="공유"><Asset name="share.svg" /></button>
        </div>
        </section>
        <section ref={commentsRef} className="os-detail-comments" aria-label="댓글">
          {comments.filter((comment) => !comment.parentId).map((comment) => (
            <OpensourceCommentThread
              key={comment.id}
              comment={comment}
              replies={comments.filter((reply) => reply.parentId === comment.id)}
              menuId={menuId}
              onMenu={(id) => setMenuId((current) => current === id ? null : id)}
              onReply={(target) => {
                setReplyTo(target);
                requestAnimationFrame(() => composerInputRef.current?.focus());
              }}
              onVote={toggleCommentVote}
              onReport={(id) => {
                setComments((items) => items.filter((item) => item.id !== id && item.parentId !== id));
                setMenuId(null);
              }}
            />
          ))}
        </section>
      </div>
      <div className="os-detail-composer">
        {replyTo && (
          <div className="os-detail-replying">
            <span>{replyTo.author}에게 답글</span>
            <button aria-label="답글 취소" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}
        <div className="os-detail-composer-row">
          <Avatar />
          <input
            ref={composerInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submitComment()}
            placeholder={replyTo ? `${replyTo.author}에게 답글 남기기` : "댓글 달기"}
          />
          <button disabled={!draft.trim()} onClick={submitComment}>게시</button>
        </div>
      </div>
    </div>
  );
}
// 인기글 상세: Figma 10637:17534의 Article 영역. 댓글 목록은 요청에 따라 제외한다.

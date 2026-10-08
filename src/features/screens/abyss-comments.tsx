"use client";

import { useCallback, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";

type Vote = "like" | "dislike" | null;
// 댓글은 2단계로 고정한다: 댓글(replies 보유) → 답글(더 이상 답글 없음).
type Reply = {
  id: number;
  author: string;
  time: string;
  text: string;
  likes: number;
  vote: Vote;
};
type Comment = Reply & { replies: Reply[] };

// 답글을 펼쳤을 때 한 번에 보여줄 최대 개수.
const REPLIES_PAGE = 10;
// 드래그로 놓았을 때 시트가 컨테이너의 절반 이하를 차지하면 닫는다.
const CLOSE_RATIO = 0.5;

// API 연결 전 화면 개발용 목 데이터입니다.
const sampleText = "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고";
let seed = 100;
const nextId = () => (seed += 1);
const leaf = (): Reply => ({
  id: nextId(),
  author: "min chong",
  time: "1초 전",
  text: sampleText,
  likes: 116,
  vote: null,
});
const withReplies = (count: number): Comment => ({
  ...leaf(),
  replies: Array.from({ length: count }, leaf),
});
const initialComments: Comment[] = [
  withReplies(2),
  withReplies(12), // 10개 초과 → "더보기" 확인용
  withReplies(1),
  withReplies(0),
];

// like/dislike 토글 시 좋아요 수를 함께 보정한다.
function applyVote<T extends Reply>(c: T, next: Exclude<Vote, null>): T {
  const vote: Vote = c.vote === next ? null : next;
  const likeDelta = (vote === "like" ? 1 : 0) - (c.vote === "like" ? 1 : 0);
  return { ...c, vote, likes: c.likes + likeDelta };
}

export function AbyssComments({
  open,
  onClose,
  go,
}: {
  open: boolean;
  onClose: () => void;
  go: Navigate;
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  // 신고 팝오버: 열린 댓글/답글 id와, ⋮ 버튼 기준 위치(top/right, 시트 좌표계).
  const [menu, setMenu] = useState<{
    id: number;
    top: number;
    right: number;
  } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [dragY, setDragY] = useState(0); // 아래로 끌어내린 픽셀 거리(>=0)
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  // 닫힘은 항상 이 핸들러들을 거치므로, 여기서 드래그/답글/메뉴 상태를 함께 초기화한다.
  const close = useCallback(() => {
    setDragY(0);
    setDragging(false);
    setReplyTo(null);
    setMenu(null);
    onClose();
  }, [onClose]);

  // ⋮ 클릭: 버튼 위치를 시트 좌표계로 환산해 그 아래에 신고 팝오버를 띄운다.
  const openMenu = useCallback((id: number, btn: HTMLElement) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const b = btn.getBoundingClientRect();
    const s = sheet.getBoundingClientRect();
    setMenu({ id, top: b.bottom - s.top + 6, right: s.right - b.right });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const containerH = overlayRef.current?.clientHeight ?? 1;
    // 시트 높이는 컨테이너의 92%. 남은 가시 높이 비율이 절반 이하이면 닫는다.
    const visibleFraction = (containerH * 0.92 - dragY) / containerH;
    if (visibleFraction <= CLOSE_RATIO) close();
    else setDragY(0);
  };

  // 좋아요/싫어요: 댓글이면 최상위에서, 답글이면 부모의 replies에서 해당 id를 보정한다.
  const toggleVote = useCallback((id: number, next: Exclude<Vote, null>) => {
    setComments((list) =>
      list.map((c) =>
        c.id === id
          ? applyVote(c, next)
          : {
              ...c,
              replies: c.replies.map((r) =>
                r.id === id ? applyVote(r, next) : r,
              ),
            },
      ),
    );
  }, []);

  // 신고: 최상위 댓글 또는 답글에서 해당 id를 제거해 내 화면에서 숨긴다.
  const report = useCallback((id: number) => {
    setComments((list) =>
      list
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) })),
    );
    setMenu(null);
  }, []);

  const goProfile = useCallback(() => {
    close();
    go("profile");
  }, [close, go]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const entry: Reply = {
      id: nextId(),
      author: "나",
      time: "방금",
      text,
      likes: 0,
      vote: null,
    };
    // 대상이 있으면 그 댓글의 답글로, 없으면 새 최상위 댓글로 추가한다.
    setComments((list) =>
      replyTo
        ? list.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...c.replies, entry] } : c,
          )
        : [...list, { ...entry, replies: [] }],
    );
    setDraft("");
    setReplyTo(null);
  };

  return (
    <div className={`abyss-comments${open ? " open" : ""}`} aria-hidden={!open}>
      <button
        className="abyss-comments-backdrop"
        aria-label="댓글 닫기"
        tabIndex={open ? 0 : -1}
        onClick={close}
      />
      <div
        ref={overlayRef}
        className="abyss-comments-anchor"
        style={{ pointerEvents: "none" }}
      >
        <section
          ref={sheetRef}
          className="abyss-comments-sheet"
          role="dialog"
          aria-label="댓글"
          style={{
            transform: open ? `translateY(${dragY}px)` : undefined,
            transition: dragging ? "none" : undefined,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div
            className="abyss-comments-grip"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span />
          </div>
          <div className="abyss-comments-list">
            {comments.map((c) => (
              <CommentNode
                key={c.id}
                comment={c}
                activeId={replyTo?.id ?? null}
                onReply={(id, author) => setReplyTo({ id, author })}
                onVote={toggleVote}
                onProfile={goProfile}
                onOpenMenu={openMenu}
              />
            ))}
          </div>

          {/* 신고 팝오버: ⋮ 바로 아래에 뜨는 작은 다크 메뉴. */}
          {menu !== null && (
            <>
              <button
                className="abyss-menu-backdrop"
                aria-label="메뉴 닫기"
                onClick={() => setMenu(null)}
              />
              <div
                className="abyss-menu"
                role="menu"
                style={{ top: menu.top, right: menu.right }}
              >
                <button
                  className="abyss-menu-report"
                  role="menuitem"
                  onClick={() => report(menu.id)}
                >
                  <FlagIcon /> 신고
                </button>
              </div>
            </>
          )}

          <div className="abyss-comments-composer">
            {replyTo && (
              <div className="abyss-comments-replying">
                <span>{replyTo.author}에게 답글</span>
                <button onClick={() => setReplyTo(null)} aria-label="답글 취소">
                  ×
                </button>
              </div>
            )}
            <div className="abyss-comments-input">
              <Avatar />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={
                  replyTo ? `${replyTo.author}에게 답글 남기기` : "댓글 달기"
                }
              />
              <button
                className="abyss-comments-send"
                onClick={submit}
                disabled={!draft.trim()}
              >
                게시
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// 최상위 댓글: 답글 접기/펼치기와 페이지네이션을 스스로 관리한다.
function CommentNode({
  comment,
  activeId,
  onReply,
  onVote,
  onProfile,
  onOpenMenu,
}: {
  comment: Comment;
  activeId: number | null;
  onReply: (id: number, author: string) => void;
  onVote: (id: number, next: Exclude<Vote, null>) => void;
  onProfile: () => void;
  onOpenMenu: (id: number, btn: HTMLElement) => void;
}) {
  // 처음 열었을 때 답글은 접힌 상태로 시작한다("답글 N개"만 보임).
  const [collapsed, setCollapsed] = useState(true);
  const [visible, setVisible] = useState(REPLIES_PAGE);
  const replies = comment.replies;
  const shown = replies.slice(0, visible);

  return (
    <div className="abyss-comment">
      <CommentBody
        comment={comment}
        active={activeId === comment.id}
        canReply
        onReply={onReply}
        onVote={onVote}
        onProfile={onProfile}
        onOpenMenu={onOpenMenu}
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
          {/* 왼쪽 긴 바: 누르면 이 댓글의 답글이 모두 접힌다. */}
          <button
            className="abyss-replies-bar"
            aria-label="답글 접기"
            onClick={() => setCollapsed(true)}
          />
          <div className="abyss-replies-body">
            {shown.map((r) => (
              <CommentBody
                key={r.id}
                comment={r}
                active={false}
                canReply={false}
                onReply={onReply}
                onVote={onVote}
                onProfile={onProfile}
                onOpenMenu={onOpenMenu}
              />
            ))}
            {replies.length > visible && (
              <button
                className="abyss-replies-more"
                onClick={() => setVisible((v) => v + REPLIES_PAGE)}
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

// 댓글/답글 공통 본문. canReply=false(=답글)이면 답글 아이콘을 감추고 본문 클릭도 막는다.
function CommentBody({
  comment,
  active,
  canReply,
  onReply,
  onVote,
  onProfile,
  onOpenMenu,
}: {
  comment: Reply;
  active: boolean;
  canReply: boolean;
  onReply: (id: number, author: string) => void;
  onVote: (id: number, next: Exclude<Vote, null>) => void;
  onProfile: () => void;
  onOpenMenu: (id: number, btn: HTMLElement) => void;
}) {
  return (
    <div className={`abyss-comment-main${active ? " active" : ""}`}>
      <div className="abyss-comment-head">
        <button
          className="abyss-comment-avatar"
          aria-label={`${comment.author} 프로필`}
          onClick={onProfile}
        >
          <Avatar />
        </button>
        <strong>{comment.author}</strong>
        <span>• {comment.time}</span>
        <button
          className="abyss-comment-option"
          aria-label="더보기"
          onClick={(e) => onOpenMenu(comment.id, e.currentTarget)}
        >
          <Asset name="option.svg" />
        </button>
      </div>
      {canReply ? (
        <button
          className="abyss-comment-text"
          onClick={() => onReply(comment.id, comment.author)}
        >
          {comment.text}
        </button>
      ) : (
        <p className="abyss-comment-text">{comment.text}</p>
      )}
      <div className="abyss-comment-actions">
        {canReply && (
          <button
            aria-label="답글"
            onClick={() => onReply(comment.id, comment.author)}
          >
            <Asset name="comment.svg" />
          </button>
        )}
        <button
          className={comment.vote === "like" ? "voted" : ""}
          aria-label="좋아요"
          aria-pressed={comment.vote === "like"}
          onClick={() => onVote(comment.id, "like")}
        >
          <Asset
            name={comment.vote === "like" ? "like-filled.svg" : "like.svg"}
          />
          {comment.likes}
        </button>
        <button
          className={`abyss-comment-dislike${comment.vote === "dislike" ? " voted" : ""}`}
          aria-label="싫어요"
          aria-pressed={comment.vote === "dislike"}
          onClick={() => onVote(comment.id, "dislike")}
        >
          <Asset
            name={comment.vote === "dislike" ? "like-filled.svg" : "like.svg"}
          />
        </button>
      </div>
    </div>
  );
}

// 신고 팝오버용 깃발 아이콘(인라인 SVG). 별도 자산 없이 currentColor를 따른다.
function FlagIcon() {
  return (
    <svg
      className="abyss-flag-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 22V4" />
      <path d="M5 4h12.5l-1.8 3.5L17.5 11H5" />
    </svg>
  );
}

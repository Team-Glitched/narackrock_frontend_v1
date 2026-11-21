import { useSearchParams } from "react-router";
import { readId } from "@/features/navigation/paths";
import { communityStyles } from "@/styles/community.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { PostUserActionsMenu } from "@/features/posts/post-user-actions-menu";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import type { CommentItem } from "./comment-model";
import { shouldSubmitOnEnter, usesTouchKeyboard } from "./submit-on-enter";
import {
  useComments,
  useReplyPage,
  type CommentsOptions,
  type CommentsState,
  type CommentWrites,
} from "./use-comments";

function resizeComposer(input: HTMLTextAreaElement) {
  const style = getComputedStyle(input);
  const lineHeight = parseFloat(style.lineHeight);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const minHeight = lineHeight + padding + border;
  const maxHeight = lineHeight * 5 + padding + border;
  input.style.height = "auto";
  const contentHeight = input.scrollHeight + border;
  input.style.height = `${Math.max(minHeight, Math.min(contentHeight, maxHeight))}px`;
  input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
}

function submitOnEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  const { key, shiftKey, keyCode } = event;
  const isComposing = event.nativeEvent.isComposing;
  if (!shouldSubmitOnEnter({ key, shiftKey, keyCode, isComposing }, usesTouchKeyboard())) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

type CommentsViewProps = {
  onProfile?: (id: number) => void;
  focus?: boolean | number;
  header?: React.ReactNode;
};

/** A comment list with its own state; pages that also report the comments to the app use `useComments` + `CommentsView`. */
export function CommonComments({
  onProfile,
  focus,
  header,
  ...options
}: CommentsOptions & CommentsViewProps) {
  const comments = useComments(options);
  return <CommentsView comments={comments} onProfile={onProfile} focus={focus} header={header} />;
}

/** The web comment list and composer for the state of `useComments`. */
export function CommentsView({
  comments,
  onProfile,
  focus = false,
  header,
}: CommentsViewProps & { comments: CommentsState }) {
  const { requestLogin } = useLoginPrompt();
  const { currentUserId, canRead, canWrite, writable, top, reply, draft, setDraft, busy } =
    comments;
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (input.current) resizeComposer(input.current);
  }, [draft]);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    let width = -1;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      resizeComposer(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    comments.send(draft);
  }
  const row = (item: CommentItem, thread?: { count: number; open: boolean }, parentId?: number) => (
    <CommentCard
      key={item.id}
      item={item}
      writes={comments.writes}
      onHide={() => comments.hide(item, parentId ?? null)}
      canReply={canWrite}
      replyCount={thread?.count}
      repliesExpanded={thread?.open}
      onToggleReplies={
        thread?.count ? () => comments.toggleReplies(item, thread.open) : undefined
      }
      onReply={
        thread
          ? () => {
              if (comments.startReply(item)) input.current?.focus();
            }
          : undefined
      }
      onProfile={() => onProfile?.(item.userId)}
      onReport={comments.report ? () => comments.report?.(item.id) : undefined}
    />
  );
  return (
    <div className={communityStyles.nrComments}>
      <div
        className={cn(communityStyles.nrCommentsList, sharedStyles.scrollContent)}
        aria-label="댓글 목록"
      >
        {header}
        {top.error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center text-body leading-5 text-[#ff8d8d]"
          >
            <p className="m-0">{top.error}</p>
            <button
              type="button"
              className={buttonVariants({ tone: "secondary", size: "compact" })}
              onClick={top.retry}
            >
              다시 시도
            </button>
          </div>
        )}
        {canRead && !top.items && !top.error && <p role="status">댓글을 불러오는 중...</p>}
        {top.items?.length === 0 && (
          <p className={communityStyles.nrCommentsEmpty}>첫 댓글을 남겨보세요.</p>
        )}
        {comments.threads?.map(({ item, replyCount, expanded }) => (
          <section
            className={communityStyles.nrCommentThread}
            key={item.id}
            aria-label={`${item.author} 댓글 대화`}
          >
            {row(item, { count: replyCount, open: expanded })}
            {expanded && replyCount > 0 && (
              <Replies
                key={item.id}
                comments={comments}
                parentId={item.id}
                render={(child) => row(child, undefined, item.id)}
              />
            )}
          </section>
        ))}
        {top.hasMore && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={top.moreBusy}
            onClick={top.more}
          >
            {top.moreBusy ? "불러오는 중..." : "댓글 더보기"}
          </button>
        )}
      </div>
      <form className={communityStyles.nrCommentComposer} onSubmit={submit}>
        {reply && (
          <div className={communityStyles.nrCommentReplying}>
            <span>{reply.author}에게 답글</span>
            <button type="button" aria-label="답글 취소" onClick={comments.cancelReply}>
              <Asset name="search-close.svg" />
            </button>
          </div>
        )}
        {comments.error && <p role="alert">{comments.error}</p>}
        {comments.hideError && <p role="alert">{comments.hideError}</p>}
        <div className={communityStyles.nrCommentInput}>
          {currentUserId === null ? (
            <button
              type="button"
              className="box-border min-h-9 min-w-0 flex-1 rounded-[20px] bg-app-surface py-2 pr-2.5 pl-3 text-left text-body leading-[20px] text-app-muted"
              onClick={() => requestLogin()}
            >
              {canRead
                ? "로그인 후 댓글을 작성할 수 있습니다."
                : "로그인 후 댓글을 확인하고 작성할 수 있습니다."}
            </button>
          ) : (
            <textarea
              ref={input}
              rows={1}
              aria-label="댓글 내용"
              placeholder="입력"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={submitOnEnter}
              disabled={busy || !writable}
            />
          )}
          <button
            type="submit"
            aria-label="댓글 보내기"
            disabled={
              busy || comments.hiding || (currentUserId !== null && (!writable || !draft.trim()))
            }
          >
            <Asset name="comment-send.svg" />
          </button>
        </div>
      </form>
      {comments.dialogs}
    </div>
  );
}
function Replies({
  comments,
  parentId,
  render,
}: {
  comments: CommentsState;
  parentId: number;
  render: (item: CommentItem) => React.ReactNode;
}) {
  const { page, visibleItems, remaining, showMore } = useReplyPage(
    comments.adapter,
    parentId,
    comments.hiddenIds,
    comments.hiddenReplyCounts.get(parentId) ?? 0,
    (id) => comments.resolveHidden(id, parentId),
  );
  return (
    <div className={communityStyles.nrCommentReplies}>
      <span className={communityStyles.nrRepliesRail} aria-hidden="true" />
      <div className={communityStyles.nrRepliesBody}>
        {page.error && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 py-2 text-body leading-5 text-[#ff8d8d]"
          >
            <p className="m-0">{page.error}</p>
            <button
              type="button"
              className={buttonVariants({ tone: "secondary", size: "compact" })}
              onClick={page.retry}
            >
              다시 시도
            </button>
          </div>
        )}
        {!page.items && !page.error && <p role="status">답글을 불러오는 중...</p>}
        {visibleItems?.map(render)}
        {showMore && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={page.moreBusy}
            onClick={page.more}
          >
            {page.moreBusy ? "불러오는 중..." : `더보기 (${remaining})`}
          </button>
        )}
      </div>
    </div>
  );
}
function CommentCard({
  item,
  canReply,
  writes,
  onHide,
  onReply,
  replyCount,
  repliesExpanded,
  onToggleReplies,
  onProfile,
  onReport,
}: {
  item: CommentItem;
  canReply: boolean;
  writes: CommentWrites;
  onHide: () => void;
  onReply?: () => void;
  replyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
  onProfile: () => void;
  onReport?: () => void;
}) {
  const [commentLink] = useSearchParams();
  const highlighted = readId(commentLink.get("commentId")) === item.id;
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlighted) card.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [longText, setLongText] = useState(false);
  const [fullText, setFullText] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || fullText) return;
    const measure = () => setLongText(text.scrollHeight > text.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [item.text, fullText, editing]);
  const [draft, setDraft] = useState(item.text);
  const [confirm, setConfirm] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  const can = writes.can(item);
  const { busy, reacting, error } = writes.state(item.id);
  const [moderating, setModerating] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  // Edit, delete and moderator delete close their form once saved.
  function done(saved: boolean) {
    if (!saved) return;
    setEditing(false);
    setConfirm(false);
    setModerating(false);
  }
  function edit(remove = false) {
    if (busy) return;
    void (remove ? writes.remove(item) : writes.edit(item, draft)).then(done);
  }
  return (
    <article
      ref={card}
      data-comment-id={item.id}
      className={cn(
        communityStyles.nrCommentCard,
        highlighted && "rounded-xl bg-violet-400/10 ring-1 ring-violet-400/40",
      )}
    >
      <div className={communityStyles.nrCommentAuthor}>
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 p-0 text-left transition-opacity hover:opacity-85"
          aria-label={`${item.author} 프로필`}
          onClick={onProfile}
        >
          <span className={communityStyles.nrCommentAvatar}>
            <Avatar size="xs" src={item.avatarUrl} />
          </span>
          <strong>{item.author}</strong>
        </button>
        <span>• {item.time}</span>
        <button
          type="button"
          ref={optionButton}
          className={communityStyles.nrCommentMore}
          aria-label="댓글 더보기"
          aria-expanded={menu}
          onClick={() => setMenu((value) => !value)}
        >
          <Asset name="post-more.svg" />
        </button>
      </div>
      {menu && (
        <PostUserActionsMenu
          anchorRef={optionButton}
          onClose={() => setMenu(false)}
          onReport={
            onReport
              ? () => {
                  setMenu(false);
                  onReport();
                }
              : undefined
          }
          onHide={() => {
            setMenu(false);
            onHide();
          }}
          onEdit={
            can.edit
              ? () => {
                  setEditing(true);
                  setMenu(false);
                }
              : undefined
          }
          onDelete={
            can.edit
              ? () => {
                  setConfirm(true);
                  setMenu(false);
                }
              : undefined
          }
          onModerateDelete={
            can.moderate
              ? () => {
                  setModerating(true);
                  setMenu(false);
                }
              : undefined
          }
        />
      )}
      {editing ? (
        <form
          className={communityStyles.nrCommentEdit}
          onSubmit={(event) => {
            event.preventDefault();
            edit();
          }}
        >
          <textarea
            aria-label="댓글 내용 수정"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={submitOnEnter}
          />
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
          <button disabled={busy || !draft.trim()}>저장</button>
        </form>
      ) : (
        <>
          <p
            ref={textRef}
            className={cn(communityStyles.nrCommentText, !fullText && "line-clamp-3!")}
          >
            {item.text}
          </p>
          {longText && (
            <button
              type="button"
              className="mt-1 block pl-6 text-caption text-app-muted"
              aria-expanded={fullText}
              onClick={() => setFullText(!fullText)}
            >
              {fullText ? "접기" : "자세히 보기"}
            </button>
          )}
        </>
      )}
      {confirm && (
        <div className={communityStyles.nrCommentDelete}>
          <p>이 댓글을 삭제할까요?</p>
          <button onClick={() => setConfirm(false)}>취소</button>
          <button disabled={busy} onClick={() => edit(true)}>
            삭제 확인
          </button>
        </div>
      )}
      {moderating && (
        <div className={communityStyles.nrCommentDelete}>
          <p>운영자 권한으로 이 댓글을 삭제할까요?</p>
          <input
            aria-label="운영 삭제 사유"
            placeholder="삭제 사유"
            maxLength={500}
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
          />
          <button onClick={() => setModerating(false)}>취소</button>
          <button
            disabled={busy || !moderationReason.trim()}
            onClick={() => {
              if (!busy) void writes.moderate(item, moderationReason).then(done);
            }}
          >
            삭제 확인
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className={communityStyles.nrCommentActions}>
        {onToggleReplies && onReply && canReply && (
          <button
            type="button"
            className="mr-auto text-caption! font-medium! text-app-muted! hover:text-app-fg!"
            aria-label={`${item.author}에게 답글 달기`}
            onClick={onReply}
          >
            답글 달기
          </button>
        )}
        <button
          type="button"
          aria-label="댓글 좋아요"
          aria-pressed={item.isLiked}
          disabled={!can.react || reacting}
          onClick={() => void writes.vote(item, "like")}
        >
          <Asset name={item.isLiked ? "v3-comment-like-on.svg" : "v3-comment-like-off.svg"} />
          <span className="tabular-nums">{item.likes}</span>
        </button>
        <button
          type="button"
          aria-label={`댓글 싫어요 ${item.dislikes}개`}
          aria-pressed={item.isDisliked}
          disabled={!can.react || reacting}
          onClick={() => void writes.vote(item, "dislike")}
        >
          <Asset
            name={item.isDisliked ? "v3-comment-dislike-on.svg" : "v3-comment-dislike-off.svg"}
          />
        </button>
        {replyCount !== undefined && (
          <button
            type="button"
            aria-label={
              onToggleReplies
                ? repliesExpanded
                  ? "답글 접기"
                  : `답글 ${replyCount}개 보기`
                : "답글 작성"
            }
            aria-expanded={onToggleReplies ? repliesExpanded : undefined}
            disabled={!onToggleReplies && !canReply}
            onClick={onToggleReplies ?? onReply}
          >
            <Asset name="comment-reply.svg" />
            <span className="tabular-nums">{replyCount}</span>
          </button>
        )}
      </div>
    </article>
  );
}

import { useLoginPrompt } from "@/features/auth/login-prompt";
import { communityStyles } from "@/styles/community.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { PostUserActionsMenu } from "@/features/posts/post-user-actions-menu";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import type { CommentAdapter, CommentItem } from "./comment-model";
import { commentKeys, commentPagesQuery, loadedComments, updateCachedReaction } from "./comment-queries";

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

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function useCommentPage(adapter: CommentAdapter, parentId: number | null) {
  const userId = useCurrentUserId();
  const { data, error, isError, isFetching, isFetchNextPageError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useInfiniteQuery(commentPagesQuery(userId, adapter, parentId));
  const items = useMemo(() => (data ? loadedComments(data.pages) : null), [data]);
  return {
    items,
    total: data?.pages.at(-1)?.total ?? 0,
    hasMore: hasNextPage,
    // A retried or next request hides the previous failure while it runs.
    error:
      isError && !isFetching
        ? errorText(error, isFetchNextPageError ? "답글을 더 불러오지 못했습니다." : "댓글을 불러오지 못했습니다.")
        : null,
    more: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
    },
    moreBusy: isFetchingNextPage,
    retry: () => void refetch(),
  };
}

export function CommonComments({
  adapter,
  currentUserId,
  onProfile,
  canWrite = true,
  onChanged,
  focus = false,
  header,
}: {
  adapter: CommentAdapter;
  currentUserId: number | null;
  onProfile?: (id: number) => void;
  canWrite?: boolean;
  /** After every comment write (create, edit, delete); counts owned by the target must be re-read. */
  onChanged?: () => void;
  focus?: boolean | number;
  header?: React.ReactNode;
}) {
  const { requireLogin, requestLogin } = useLoginPrompt();
  const writable = canWrite && currentUserId !== null;
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [reply, setReply] = useState<{ threadId: number; author: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<number | null>(null);
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
  const top = useCommentPage(adapter, null);
  // Writes change counts and threads; every cached thread of the target re-reads from the server.
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: commentKeys.target(userId, adapter.kind, adapter.targetId) });
    onChanged?.();
  };
  const create = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: number | null }) => adapter.create(text, parentId),
    onSuccess: () => {
      setDraft("");
      setReply(null);
      changed();
    },
  });
  const busy = create.isPending;
  const error = create.isError ? errorText(create.error, "댓글을 등록하지 못했습니다.") : null;
  const toggle = (id: number) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const startReply = (item: CommentItem, threadId: number) => {
    setReply({ threadId, author: item.author });
    setExpanded((old) => new Set([...old, threadId]));
    input.current?.focus();
  };
  const report = adapter.report;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!requireLogin() || busy || !writable || !draft.trim()) return;
    create.mutate({ text: draft.trim(), parentId: reply?.threadId ?? null });
  }
  const row = (item: CommentItem, threadId: number) => (
    <CommentCard
      key={item.id}
      item={item}
      owner={currentUserId === item.userId}
      adapter={adapter}
      onChanged={changed}
      canReply={canWrite}
      onReply={() => {
        if (requireLogin() && writable) startReply(item, threadId);
      }}
      onProfile={() => onProfile?.(item.userId)}
      onReport={report ? () => {
        if (requireLogin()) setReportTarget(item.id);
      } : undefined}
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
          <div role="alert">
            {top.error}
            <button onClick={top.retry}>다시 시도</button>
          </div>
        )}
        {!top.items && !top.error && <p role="status">댓글을 불러오는 중...</p>}
        {top.items?.length === 0 && (
          <p className={communityStyles.nrCommentsEmpty}>첫 댓글을 남겨보세요.</p>
        )}
        {top.items?.map((item) => (
          <section
            className={communityStyles.nrCommentThread}
            key={item.id}
            aria-label={`${item.author} 댓글 대화`}
          >
            {row(item, item.id)}
            {item.replyCount > 0 && (
              <button
                className={communityStyles.nrRepliesToggle}
                aria-expanded={expanded.has(item.id)}
                onClick={() => toggle(item.id)}
              >
                {expanded.has(item.id) ? "답글 접기" : `답글 ${item.replyCount}개`}
              </button>
            )}
            {expanded.has(item.id) && item.replyCount > 0 && (
              <Replies
                key={item.id}
                adapter={adapter}
                parentId={item.id}
                render={(child) => row(child, item.id)}
                onCollapse={() => toggle(item.id)}
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
            <button type="button" aria-label="답글 취소" onClick={() => setReply(null)}>
              <Asset name="search-close.svg" />
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className={communityStyles.nrCommentInput}>
          <span className={communityStyles.nrCommentAttachment} aria-hidden="true">
            <i />
            <i />
          </span>
          {currentUserId === null ? (
            <button
              type="button"
              className="box-border min-h-9 min-w-0 flex-1 rounded-[20px] bg-app-surface py-2 pr-2.5 pl-[38px] text-left text-body leading-[20px] text-app-muted"
              onClick={() => requestLogin()}
            >
              로그인 후 댓글을 작성할 수 있습니다.
            </button>
          ) : (
            <textarea
              ref={input}
              rows={1}
              aria-label="댓글 내용"
              placeholder="입력"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy || !writable}
            />
          )}
          <button
            type="submit"
            aria-label="댓글 보내기"
            disabled={busy || (currentUserId !== null && (!writable || !draft.trim()))}
          >
            <Asset name="comment-send.svg" />
          </button>
        </div>
      </form>
      {reportTarget !== null && report && (
        <FigmaSheet title="신고" onClose={() => setReportTarget(null)}>
          <ReportReasons
            onSubmit={(reason, description) => report(reportTarget, reason, description)}
            onDone={() => setReportTarget(null)}
          />
        </FigmaSheet>
      )}
    </div>
  );
}
function Replies({
  adapter,
  parentId,
  render,
  onCollapse,
}: {
  adapter: CommentAdapter;
  parentId: number;
  render: (item: CommentItem) => React.ReactNode;
  onCollapse: () => void;
}) {
  const page = useCommentPage(adapter, parentId);
  return (
    <div className={communityStyles.nrCommentReplies}>
      <button
        className={communityStyles.nrRepliesRail}
        aria-label="답글 접기"
        onClick={onCollapse}
      />
      <div className={communityStyles.nrRepliesBody}>
        {page.error && (
          <div role="alert">
            <p>{page.error}</p>
            <button className={communityStyles.nrCommentsMore} onClick={page.retry}>
              다시 시도
            </button>
          </div>
        )}
        {!page.items && !page.error && <p role="status">답글을 불러오는 중...</p>}
        {page.items?.map(render)}
        {page.items && page.hasMore && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={page.moreBusy}
            onClick={page.more}
          >
            {page.moreBusy
              ? "불러오는 중..."
              : `더보기 (${page.total - page.items.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
function CommentCard({
  item,
  canReply,
  owner,
  adapter,
  onChanged,
  onReply,
  onProfile,
  onReport,
}: {
  item: CommentItem;
  canReply: boolean;
  owner: boolean;
  adapter: CommentAdapter;
  onChanged: () => void;
  onReply: () => void;
  onProfile: () => void;
  onReport?: () => void;
}) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [confirm, setConfirm] = useState(false);
  const [hidden, setHidden] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  const { requireLogin } = useLoginPrompt();
  const react = adapter.react;
  const canEdit = owner && adapter.update !== undefined && adapter.remove !== undefined;
  const moderate = owner ? undefined : adapter.moderate;
  const [moderating, setModerating] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  const reaction = useMutation({
    mutationFn: ({ send, kind }: { send: NonNullable<CommentAdapter["react"]>; kind: "like" | "dislike" }) =>
      send(item.id, kind),
    onSuccess: (result) => updateCachedReaction(queryClient, userId, adapter, item.id, result),
  });
  // Edit, delete and moderator delete share one in-flight guard; `failure` is the message for a non-Error cause.
  const change = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown> | undefined; failure: string }) => {
      await run();
    },
    onSuccess: () => {
      setEditing(false);
      setConfirm(false);
      setModerating(false);
      onChanged();
    },
  });
  const busy = change.isPending;
  const reacting = reaction.isPending;
  const error = reaction.isError
    ? errorText(reaction.error, "반응을 반영하지 못했습니다.")
    : change.isError
      ? errorText(change.error, change.variables.failure)
      : null;
  function removeAsModerator() {
    if (!moderate || busy || !moderationReason.trim()) return;
    const reason = moderationReason.trim();
    reaction.reset();
    change.mutate({ run: () => moderate(item.id, reason), failure: "댓글을 삭제하지 못했습니다." });
  }
  function vote(kind: "like" | "dislike") {
    if (!react || reacting || !requireLogin()) return;
    change.reset();
    reaction.mutate({ send: react, kind });
  }
  function edit(remove = false) {
    if (!canEdit || busy || (!remove && !draft.trim())) return;
    const text = draft.trim();
    reaction.reset();
    change.mutate({
      run: () => (remove ? adapter.remove?.(item.id) : adapter.update?.(item.id, text)),
      failure: "댓글을 변경하지 못했습니다.",
    });
  }
  if (hidden) return null;
  return (
    <article className={communityStyles.nrCommentCard}>
      <div className={communityStyles.nrCommentAuthor}>
        <button
          className={communityStyles.nrCommentAvatar}
          aria-label={`${item.author} 프로필`}
          onClick={onProfile}
        >
          <Avatar src={item.avatarUrl} />
        </button>
        <strong>{item.author}</strong>
        <span>• {item.time}</span>
        <button
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
            setHidden(true);
          }}
          onEdit={
            canEdit
              ? () => {
                  setEditing(true);
                  setMenu(false);
                }
              : undefined
          }
          onDelete={
            canEdit
              ? () => {
                  setConfirm(true);
                  setMenu(false);
                }
              : undefined
          }
          onModerateDelete={
            moderate
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
          />
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
          <button disabled={busy || !draft.trim()}>저장</button>
        </form>
      ) : (
        <button className={communityStyles.nrCommentText} onClick={onReply} disabled={!canReply}>
          {item.text}
        </button>
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
          <button disabled={busy || !moderationReason.trim()} onClick={removeAsModerator}>
            삭제 확인
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className={communityStyles.nrCommentActions}>
        <button
          aria-label="댓글 좋아요"
          aria-pressed={item.isLiked}
          disabled={!react || reacting}
          onClick={() => vote("like")}
        >
          <Asset name={item.isLiked ? "v3-comment-like-on.svg" : "v3-comment-like-off.svg"} />
          {item.likes}
        </button>
        <button
          aria-label={`댓글 싫어요 ${item.dislikes}개`}
          aria-pressed={item.isDisliked}
          disabled={!react || reacting}
          onClick={() => vote("dislike")}
        >
          <Asset
            name={item.isDisliked ? "v3-comment-dislike-on.svg" : "v3-comment-dislike-off.svg"}
          />
        </button>
        <button aria-label={`${item.author}에게 답글 작성`} disabled={!canReply} onClick={onReply}>
          <Asset name="comment-reply.svg" />
        </button>
      </div>
    </article>
  );
}

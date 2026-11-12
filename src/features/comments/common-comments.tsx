import { useSearchParams } from "react-router";
import { readId } from "@/features/navigation/paths";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { communityStyles } from "@/styles/community.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { apiOrigin } from "@/lib/api/client";
import { useHiddenIds } from "@/lib/browser/hidden-ids";
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
import { commentKeys, commentPagesQuery, loadedComments, openCommentHideChannel, updateCachedReaction } from "./comment-queries";
import { shouldSubmitOnEnter, usesTouchKeyboard } from "./submit-on-enter";

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

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function useCommentPage(adapter: CommentAdapter, parentId: number | null, enabled = true) {
  const userId = useCurrentUserId();
  const { data, error, isError, isFetching, isFetchNextPageError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({ ...commentPagesQuery(userId, adapter, parentId), enabled });
  const items = useMemo(() => (data ? loadedComments(data.pages) : null), [data]);
  const [link] = useSearchParams();
  const target = readId(link.get("commentId")), root = readId(link.get("parentCommentId")) ?? target;
  const sought = parentId === null ? root : parentId === readId(link.get("parentCommentId")) ? target : null;
  useEffect(() => {
    if (enabled && sought && items && !items.some((item) => item.id === sought) && hasNextPage && !isFetching && !isError)
      void fetchNextPage({ cancelRefetch: false });
  }, [enabled, sought, items, hasNextPage, isFetching, isError, fetchNextPage]);
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
  commentsNotice,
}: {
  adapter: CommentAdapter;
  currentUserId: number | null;
  onProfile?: (id: number) => void;
  canWrite?: boolean;
  /** After every comment write (create, edit, delete); counts owned by the target must be re-read. */
  onChanged?: () => void;
  focus?: boolean | number;
  header?: React.ReactNode;
  commentsNotice?: React.ReactNode;
}) {
  const { requireLogin, requestLogin } = useLoginPrompt();
  const writable = canWrite && currentUserId !== null;
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { ids: hiddenIds, hide } = useHiddenIds(
    adapter.hide ? null : `narackrock.hidden-comments.${apiOrigin()}.${userId ?? "guest"}.${adapter.kind}.${adapter.targetId}`,
  );
  const hiddenReplyCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const parentId of hiddenIds.values()) {
      if (parentId !== null) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    }
    return counts;
  }, [hiddenIds]);
  const [commentLink] = useSearchParams();
  const linkedParent = readId(commentLink.get("parentCommentId"));
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(linkedParent ? [linkedParent] : []));
  const [linkedThread, setLinkedThread] = useState(linkedParent);
  if (linkedThread !== linkedParent) {
    setLinkedThread(linkedParent);
    if (linkedParent) setExpanded((old) => new Set([...old, linkedParent]));
  }
  const [reply, setReply] = useState<{ commentId: number; threadId: number; author: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [hiddenOnServerId, setHiddenOnServerId] = useState<number | null>(null);
  if (hiddenOnServerId !== null) setHiddenOnServerId(null);
  if (reply && (
    hiddenIds.has(reply.commentId) ||
    hiddenIds.has(reply.threadId) ||
    hiddenOnServerId === reply.commentId ||
    hiddenOnServerId === reply.threadId
  )) {
    setReply(null);
    setDraft("");
  }
  const hideChannel = useRef<BroadcastChannel | null>(null);
  const serverHideEnabled = adapter.hide !== undefined;
  const { kind, targetId } = adapter;
  useEffect(() => {
    if (!serverHideEnabled || userId === null) return;
    const channel = openCommentHideChannel(userId, kind, targetId);
    if (!channel) return;
    hideChannel.current = channel;
    channel.onmessage = ({ data }) => {
      if (typeof data !== "number" || !Number.isSafeInteger(data) || data <= 0) return;
      setHiddenOnServerId(data);
      void queryClient.invalidateQueries({ queryKey: commentKeys.target(userId, kind, targetId) });
      onChanged?.();
    };
    return () => {
      hideChannel.current = null;
      channel.close();
    };
  }, [serverHideEnabled, userId, kind, targetId, queryClient, onChanged]);
  const [reportTarget, setReportTarget] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (input.current) resizeComposer(input.current);
  }, [draft, commentsNotice]);
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
  }, [commentsNotice]);
  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus, commentsNotice]);
  const top = useCommentPage(adapter, null, !commentsNotice);
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
  const hideOnServer = useMutation({
    mutationFn: async (commentId: number) => {
      await adapter.hide?.(commentId);
    },
    onSuccess: async (_, commentId) => {
      setHiddenOnServerId(commentId);
      hideChannel.current?.postMessage(commentId);
      onChanged?.();
      await queryClient.invalidateQueries({
        queryKey: commentKeys.target(userId, adapter.kind, adapter.targetId),
      });
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
    setReply({ commentId: item.id, threadId, author: item.author });
    setExpanded((old) => new Set([...old, threadId]));
    input.current?.focus();
  };
  const report = adapter.report;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!requireLogin() || busy || hideOnServer.isPending || !writable || !draft.trim()) return;
    create.mutate({ text: draft.trim(), parentId: reply?.threadId ?? null });
  }
  const row = (item: CommentItem, threadId?: number) => (
    <CommentCard
      key={item.id}
      item={item}
      owner={currentUserId === item.userId}
      adapter={adapter}
      onChanged={changed}
      onHide={() => {
        if (!adapter.hide) {
          hide(item.id, item.id === threadId ? null : threadId);
        } else if (!hideOnServer.isPending && requireLogin()) {
          hideOnServer.mutate(item.id);
        }
      }}
      canReply={canWrite}
      onReply={threadId === undefined ? undefined : () => {
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
        {commentsNotice ?? (<>
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
          {top.items?.filter((item) => !hiddenIds.has(item.id)).map((item) => {
            const replyCount = Math.max(0, item.replyCount - (hiddenReplyCounts.get(item.id) ?? 0));
            return (
              <section
                className={communityStyles.nrCommentThread}
                key={item.id}
                aria-label={`${item.author} 댓글 대화`}
              >
                {row(item, item.id)}
                {replyCount > 0 && (
                  <button
                    className={communityStyles.nrRepliesToggle}
                    aria-expanded={expanded.has(item.id)}
                    onClick={() => toggle(item.id)}
                  >
                    {expanded.has(item.id) ? "답글 접기" : `답글 ${replyCount}개`}
                  </button>
                )}
                {expanded.has(item.id) && replyCount > 0 && (
                  <Replies
                    key={item.id}
                    adapter={adapter}
                    parentId={item.id}
                    hiddenIds={hiddenIds}
                    hiddenCount={hiddenReplyCounts.get(item.id) ?? 0}
                    onResolveHidden={(id) => hide(id, item.id)}
                    render={(child) => row(child)}
                    onCollapse={() => toggle(item.id)}
                  />
                )}
              </section>
            );
          })}
          {top.hasMore && (
            <button
              className={communityStyles.nrCommentsMore}
              disabled={top.moreBusy}
              onClick={top.more}
            >
              {top.moreBusy ? "불러오는 중..." : "댓글 더보기"}
            </button>
          )}
        </>)}
      </div>
      {!commentsNotice && (
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
          {hideOnServer.isError && (
            <p role="alert">{errorText(hideOnServer.error, "댓글을 숨기지 못했습니다.")}</p>
          )}
          <div className={communityStyles.nrCommentInput}>
            {currentUserId === null ? (
              <button
                type="button"
                className="box-border min-h-9 min-w-0 flex-1 rounded-[20px] bg-app-surface py-2 pr-2.5 pl-3 text-left text-body leading-[20px] text-app-muted"
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
                onKeyDown={submitOnEnter}
                disabled={busy || !writable}
              />
            )}
            <button
              type="submit"
              aria-label="댓글 보내기"
              disabled={busy || hideOnServer.isPending || (currentUserId !== null && (!writable || !draft.trim()))}
            >
              <Asset name="comment-send.svg" />
            </button>
          </div>
        </form>
      )}
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
  hiddenIds,
  hiddenCount,
  onResolveHidden,
  render,
  onCollapse,
}: {
  adapter: CommentAdapter;
  parentId: number;
  hiddenIds: ReadonlyMap<number, number | null>;
  hiddenCount: number;
  onResolveHidden: (id: number) => void;
  render: (item: CommentItem) => React.ReactNode;
  onCollapse: () => void;
}) {
  const page = useCommentPage(adapter, parentId);
  const { items } = page;
  useEffect(() => {
    // Older stored entries contain only the comment ID.
    for (const item of items ?? []) {
      if (hiddenIds.get(item.id) === null) onResolveHidden(item.id);
    }
  }, [items, hiddenIds, onResolveHidden]);
  const visibleItems = items?.filter((item) => !hiddenIds.has(item.id));
  const remaining = Math.max(0, page.total - hiddenCount - (visibleItems?.length ?? 0));
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
        {visibleItems?.map(render)}
        {items && page.hasMore && remaining > 0 && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={page.moreBusy}
            onClick={page.more}
          >
            {page.moreBusy
              ? "불러오는 중..."
              : `더보기 (${remaining})`}
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
  onHide,
  onReply,
  onProfile,
  onReport,
}: {
  item: CommentItem;
  canReply: boolean;
  owner: boolean;
  adapter: CommentAdapter;
  onChanged: () => void;
  onHide: () => void;
  onReply?: () => void;
  onProfile: () => void;
  onReport?: () => void;
}) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [commentLink] = useSearchParams();
  const highlighted = readId(commentLink.get("commentId")) === item.id;
  const card = useRef<HTMLElement>(null);
  useEffect(() => { if (highlighted) card.current?.scrollIntoView({ block: "center" }); }, [highlighted]);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [confirm, setConfirm] = useState(false);
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
  return (
    <article ref={card} data-comment-id={item.id} className={cn(communityStyles.nrCommentCard, highlighted && "rounded-xl bg-violet-400/10 ring-1 ring-violet-400/40")}>
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
            onHide();
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
            onKeyDown={submitOnEnter}
          />
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
          <button disabled={busy || !draft.trim()}>저장</button>
        </form>
      ) : onReply ? (
        <button className={communityStyles.nrCommentText} onClick={onReply} disabled={!canReply}>
          {item.text}
        </button>
      ) : (
        <p className={communityStyles.nrCommentText}>{item.text}</p>
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
        {onReply && (
          <button aria-label={`${item.author}에게 답글 작성`} disabled={!canReply} onClick={onReply}>
            <Asset name="comment-reply.svg" />
          </button>
        )}
      </div>
    </article>
  );
}

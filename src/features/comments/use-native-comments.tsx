/**
 * The app's view of a comment list (types: src/lib/native-screens/comments.ts; drawn by
 * native/ui/comments.tsx).
 *
 * `useNativeComments(comments, { onProfile, focus })` takes the state of `useComments` (the same
 * instance the web `CommentsView` draws, so writes, hidden comments and the report sheet are shared)
 * and returns:
 * - `model`: `NativeComments` for the screen's model;
 * - `act(action)`: performs a `NativeCommentAction` with the web handlers (login prompt, mutations,
 *   report sheet);
 * - `node`: loaders of the expanded reply threads; the bridge must render it.
 * `focus` is a counter the page moves to focus the composer (e.g. a post's comment button).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { readId } from "@/features/navigation/paths";
import type { NativeComment, NativeCommentAction, NativeComments } from "@/lib/native-screens";
import type { CommentItem } from "./comment-model";
import { useReplyPage, type CommentsState } from "./use-comments";

type ReplySnapshot = {
  items: CommentItem[] | null;
  error: string | null;
  more: { remaining: number; busy: boolean } | null;
};
type ReplyHandlers = { loadMore: () => void; retry: () => void };

export type NativeCommentsBinding = {
  model: NativeComments;
  act: (action: NativeCommentAction) => void;
  node: ReactNode;
};

export function useNativeComments(
  comments: CommentsState,
  { onProfile, focus = 0 }: { onProfile?: (userId: number) => void; focus?: number },
): NativeCommentsBinding {
  const { requestLogin } = useLoginPrompt();
  const [link] = useSearchParams();
  const highlightedId = readId(link.get("commentId"));
  const [replies, setReplies] = useState<ReadonlyMap<number, ReplySnapshot & ReplyHandlers>>(
    () => new Map(),
  );
  const report = useCallback((parentId: number, page: (ReplySnapshot & ReplyHandlers) | null) => {
    setReplies((old) => {
      const next = new Map(old);
      if (page) next.set(parentId, page);
      else next.delete(parentId);
      return next;
    });
  }, []);
  const { writes, top } = comments;

  // Every shown comment with its thread, for actions that name a comment by id.
  const shown = new Map<
    number,
    { item: CommentItem; parentId: number | null; expanded: boolean }
  >();
  const native = (item: CommentItem, parentId: number | null, expanded = false): NativeComment => {
    shown.set(item.id, { item, parentId, expanded });
    const can = writes.can(item);
    const write = writes.state(item.id);
    return {
      id: item.id,
      userId: item.userId,
      author: item.author,
      avatarUrl: item.avatarUrl,
      text: item.text,
      time: item.time,
      likes: item.likes,
      dislikes: item.dislikes,
      isLiked: item.isLiked,
      isDisliked: item.isDisliked,
      highlighted: highlightedId === item.id,
      menu: { edit: can.edit, report: can.report, moderate: can.moderate },
      canReact: can.react,
      reacting: write.reacting,
      busy: write.busy,
      error: write.error,
      changed: write.changed,
    };
  };
  const open = comments.threads?.filter((thread) => thread.expanded && thread.replyCount > 0) ?? [];
  const model: NativeComments = {
    loading: comments.canRead && !top.items && !top.error,
    error: top.error,
    empty: top.items?.length === 0,
    threads: (comments.threads ?? []).map(({ item, replyCount, expanded }) => {
      const page = expanded && replyCount > 0 ? replies.get(item.id) : undefined;
      return {
        comment: native(item, null, expanded),
        replyCount,
        expanded,
        replies:
          expanded && replyCount > 0
            ? {
                items: page?.items?.map((reply) => native(reply, item.id)) ?? null,
                error: page?.error ?? null,
                more: page?.more ?? null,
              }
            : null,
      };
    }),
    more: top.hasMore ? { busy: top.moreBusy } : null,
    canReply: comments.canWrite,
    composer: {
      signedOut:
        comments.currentUserId === null
          ? comments.canRead
            ? "로그인 후 댓글을 작성할 수 있습니다."
            : "로그인 후 댓글을 확인하고 작성할 수 있습니다."
          : null,
      writable: comments.writable,
      busy: comments.busy,
      hiding: comments.hiding,
      replyTo: comments.reply?.author ?? null,
      error: comments.error,
      hideError: comments.hideError,
      cleared: comments.cleared,
      focus: focus + comments.replyFocus,
    },
  };

  function act(action: NativeCommentAction) {
    switch (action.type) {
      case "comment-send":
        return comments.send(action.text);
      case "comment-login":
        return requestLogin();
      case "comment-cancel-reply":
        return comments.cancelReply();
      case "comment-profile":
        return onProfile?.(action.userId);
      case "comments-more":
        return top.more();
      case "comments-retry":
        return top.retry();
      case "comment-replies-more":
        return replies.get(action.id)?.loadMore();
      case "comment-replies-retry":
        return replies.get(action.id)?.retry();
    }
    const target = shown.get(action.id);
    if (!target) return;
    const { item, parentId, expanded } = target;
    switch (action.type) {
      case "comment-reply":
        if (parentId === null) comments.startReply(item);
        return;
      case "comment-toggle-replies":
        if (parentId === null) comments.toggleReplies(item, expanded, action.hasDraft);
        return;
      case "comment-vote":
        return void writes.vote(item, action.vote);
      case "comment-edit":
        return void writes.edit(item, action.text);
      case "comment-delete":
        return void writes.remove(item);
      case "comment-moderate":
        return void writes.moderate(item, action.reason);
      case "comment-report":
        return comments.report?.(item.id);
      case "comment-hide":
        return comments.hide(item, parentId);
    }
  }

  return {
    model,
    act,
    node: open.map(({ item }) => (
      <ReplySource key={item.id} comments={comments} parentId={item.id} onPage={report} />
    )),
  };
}

/** Loads one expanded thread's replies (as the web's Replies does) and reports them to the list. */
function ReplySource({
  comments,
  parentId,
  onPage,
}: {
  comments: CommentsState;
  parentId: number;
  onPage: (parentId: number, page: (ReplySnapshot & ReplyHandlers) | null) => void;
}) {
  const { page, visibleItems, remaining, showMore } = useReplyPage(
    comments.adapter,
    parentId,
    comments.hiddenIds,
    comments.hiddenReplyCounts.get(parentId) ?? 0,
    (id) => comments.resolveHidden(id, parentId),
  );
  const snapshot: ReplySnapshot = {
    items: visibleItems,
    error: page.error,
    more: showMore ? { remaining, busy: page.moreBusy } : null,
  };
  // Reported only when the data changes; the handlers always run the latest page's.
  const json = JSON.stringify(snapshot);
  const handlers = useRef<ReplyHandlers>({ loadMore: page.more, retry: page.retry });
  useEffect(() => {
    handlers.current = { loadMore: page.more, retry: page.retry };
  });
  useEffect(() => {
    onPage(parentId, {
      ...(JSON.parse(json) as ReplySnapshot),
      loadMore: () => handlers.current.loadMore(),
      retry: () => handlers.current.retry(),
    });
  }, [json, parentId, onPage]);
  useEffect(() => () => onPage(parentId, null), [parentId, onPage]);
  return null;
}

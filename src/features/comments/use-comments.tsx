/**
 * Comment state shared by the web comments (CommentsView in ./common-comments.tsx) and the app's
 * native comments (./use-native-comments.tsx turns it into a view model).
 *
 * - `useComments(options)`: one instance per comment list. Holds the top-level page, expanded threads,
 *   the reply target, the web draft, hidden comments, sending, per-comment writes (`writes`) and the
 *   report sheet (`dialogs`, rendered by CommentsView). Draft-independent operations take the text
 *   explicitly so the app can keep its own draft.
 * - `useCommentPage(adapter, parentId)`: one thread (top level or replies) page by page.
 * - `useReplyPage(...)`: the visible replies of one expanded thread and how many are left to load.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FigmaSheet } from "@/components/figma-sheet";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { readId } from "@/features/navigation/paths";
import { apiOrigin } from "@/lib/api/client";
import {
  COMMENT_MAX_LENGTH,
  codePointLength,
  hasVisibleText,
  sanitizeMultiline,
  sanitizeSingleLine,
} from "@/lib/content-limits";
import { useHiddenIds } from "@/lib/browser/hidden-ids";
import type { CommentAdapter, CommentItem } from "./comment-model";
import {
  commentKeys,
  commentPagesQuery,
  loadedComments,
  openCommentHideChannel,
  updateCachedReaction,
} from "./comment-queries";
import { ReportReasons } from "./report-reasons";
import { nativeApp } from "@/lib/native-app";

export function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

/** One thread's loaded comments and paging. */
export type CommentPageState = {
  items: CommentItem[] | null;
  total: number;
  hasMore: boolean;
  error: string | null;
  more: () => void;
  moreBusy: boolean;
  retry: () => void;
};

/** One thread (`parentId` null: the top-level comments), loading until a linked comment is found. */
export function useCommentPage(
  adapter: CommentAdapter,
  parentId: number | null,
  enabled = true,
): CommentPageState {
  const userId = useCurrentUserId();
  const {
    data,
    error,
    isError,
    isFetching,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({ ...commentPagesQuery(userId, adapter, parentId), enabled });
  const items = useMemo(
    () => (enabled && data ? loadedComments(data.pages) : null),
    [data, enabled],
  );
  const [link] = useSearchParams();
  const target = readId(link.get("commentId")),
    root = readId(link.get("parentCommentId")) ?? target;
  const sought =
    parentId === null ? root : parentId === readId(link.get("parentCommentId")) ? target : null;
  useEffect(() => {
    if (
      sought &&
      items &&
      !items.some((item) => item.id === sought) &&
      hasNextPage &&
      !isFetching &&
      !isError
    )
      void fetchNextPage({ cancelRefetch: false });
  }, [sought, items, hasNextPage, isFetching, isError, fetchNextPage]);
  return {
    items,
    total: data?.pages.at(-1)?.total ?? 0,
    hasMore: enabled && hasNextPage,
    // A retried or next request hides the previous failure while it runs.
    error:
      enabled && isError && !isFetching
        ? errorText(
            error,
            isFetchNextPageError ? "답글을 더 불러오지 못했습니다." : "댓글을 불러오지 못했습니다.",
          )
        : null,
    more: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
    },
    moreBusy: isFetchingNextPage,
    retry: () => void refetch(),
  };
}

/** The replies of one expanded thread without hidden ones; `remaining` excludes hidden replies. */
export function useReplyPage(
  adapter: CommentAdapter,
  parentId: number,
  hiddenIds: ReadonlyMap<number, number | null>,
  hiddenCount: number,
  onResolveHidden: (id: number) => void,
) {
  const page = useCommentPage(adapter, parentId);
  const { items } = page;
  useEffect(() => {
    // Older stored entries contain only the comment ID.
    for (const item of items ?? []) {
      if (hiddenIds.get(item.id) === null) onResolveHidden(item.id);
    }
  }, [items, hiddenIds, onResolveHidden]);
  const visibleItems = items?.filter((item) => !hiddenIds.has(item.id)) ?? null;
  const remaining = Math.max(0, page.total - hiddenCount - (visibleItems?.length ?? 0));
  return {
    page,
    visibleItems,
    remaining,
    showMore: items !== null && page.hasMore && remaining > 0,
  };
}

/** Reaction and edit/delete state of one comment. */
export type CommentWriteState = {
  reacting: boolean;
  busy: boolean;
  error: string | null;
  /** Successful edits/deletes. */
  changed: number;
};
const idleWrite: CommentWriteState = { reacting: false, busy: false, error: null, changed: 0 };

/** What one comment may offer: the author's edit/delete, the moderator's delete, reactions, reports. */
export type CommentAbilities = {
  edit: boolean;
  moderate: boolean;
  react: boolean;
  report: boolean;
};

/**
 * Per-comment reactions and edit/delete/moderator delete. Reactions and changes each have one request
 * in flight per comment; starting one clears the comment's previous failure.
 */
export type CommentWrites = {
  state: (id: number) => CommentWriteState;
  can: (item: CommentItem) => CommentAbilities;
  vote: (item: CommentItem, kind: "like" | "dislike") => Promise<void>;
  /** Each resolves true once saved. */
  edit: (item: CommentItem, text: string) => Promise<boolean>;
  remove: (item: CommentItem) => Promise<boolean>;
  moderate: (item: CommentItem, reason: string) => Promise<boolean>;
};

function useCommentWrites(
  adapter: CommentAdapter,
  currentUserId: number | null,
  onChanged: () => void,
): CommentWrites {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { requireLogin } = useLoginPrompt();
  const [states, setStates] = useState<ReadonlyMap<number, CommentWriteState>>(() => new Map());
  const reacting = useRef(new Set<number>());
  const changing = useRef(new Set<number>());
  const update = (id: number, patch: (state: CommentWriteState) => Partial<CommentWriteState>) =>
    setStates((old) => {
      const current = old.get(id) ?? idleWrite;
      return new Map(old).set(id, { ...current, ...patch(current) });
    });
  const can = (item: CommentItem) => {
    const owner = currentUserId === item.userId;
    return {
      edit: owner && adapter.update !== undefined && adapter.remove !== undefined,
      moderate: !owner && adapter.moderate !== undefined,
      react: adapter.react !== undefined,
      report: adapter.report !== undefined,
    };
  };
  async function change(id: number, run: () => Promise<unknown> | undefined, failure: string) {
    if (changing.current.has(id)) return false;
    changing.current.add(id);
    update(id, () => ({ busy: true, error: null }));
    try {
      await run();
      update(id, (state) => ({ busy: false, changed: state.changed + 1 }));
      onChanged();
      return true;
    } catch (cause) {
      update(id, () => ({ busy: false, error: errorText(cause, failure) }));
      return false;
    } finally {
      changing.current.delete(id);
    }
  }
  return {
    state: (id: number) => states.get(id) ?? idleWrite,
    can,
    async vote(item: CommentItem, kind: "like" | "dislike") {
      const react = adapter.react;
      if (!react || reacting.current.has(item.id) || !requireLogin()) return;
      reacting.current.add(item.id);
      update(item.id, () => ({ reacting: true, error: null }));
      try {
        const result = await react(item.id, kind);
        if (
          !result ||
          typeof result.isLiked !== "boolean" ||
          typeof result.isDisliked !== "boolean" ||
          typeof result.likeCount !== "number" ||
          !Number.isFinite(result.likeCount) ||
          typeof result.dislikeCount !== "number" ||
          !Number.isFinite(result.dislikeCount)
        ) {
          throw new Error("반응 응답 형식이 올바르지 않습니다.");
        }
        updateCachedReaction(queryClient, userId, adapter, item.id, result);
        update(item.id, () => ({ reacting: false }));
      } catch (cause) {
        update(item.id, () => ({
          reacting: false,
          error: errorText(cause, "반응을 반영하지 못했습니다."),
        }));
      } finally {
        reacting.current.delete(item.id);
      }
    },
    /** Resolves true once saved. */
    edit(item: CommentItem, text: string) {
      if (!can(item).edit) return Promise.resolve(false);
      const sanitized = sanitizeMultiline(text);
      if (!sanitized || !hasVisibleText(sanitized)) return Promise.resolve(false);
      if (codePointLength(sanitized) > COMMENT_MAX_LENGTH) {
        update(item.id, () => ({
          busy: false,
          error: `댓글은 ${COMMENT_MAX_LENGTH}자 이내로 입력해 주세요.`,
        }));
        return Promise.resolve(false);
      }
      return change(
        item.id,
        () => adapter.update?.(item.id, sanitized),
        "댓글을 변경하지 못했습니다.",
      );
    },
    remove(item: CommentItem) {
      if (!can(item).edit) return Promise.resolve(false);
      return change(item.id, () => adapter.remove?.(item.id), "댓글을 변경하지 못했습니다.");
    },
    moderate(item: CommentItem, reason: string) {
      const moderate = adapter.moderate;
      if (!moderate || !can(item).moderate) return Promise.resolve(false);
      const sanitized = sanitizeSingleLine(reason);
      if (!sanitized || !hasVisibleText(sanitized)) return Promise.resolve(false);
      return change(item.id, () => moderate(item.id, sanitized), "댓글을 삭제하지 못했습니다.");
    },
  };
}

export type CommentsOptions = {
  adapter: CommentAdapter;
  currentUserId: number | null;
  canRead?: boolean;
  canWrite?: boolean;
  /** After every comment write (create, edit, delete); counts owned by the target must be re-read. */
  onChanged?: () => void;
};

export type ReplyTarget = { commentId: number; threadId: number; author: string };

/** A top-level comment with its visible reply count. */
export type CommentThread = { item: CommentItem; replyCount: number; expanded: boolean };

export type CommentsState = {
  adapter: CommentAdapter;
  currentUserId: number | null;
  canRead: boolean;
  canWrite: boolean;
  /** Signed in and writing allowed. */
  writable: boolean;
  top: CommentPageState;
  /** Visible top-level comments; null until loaded. */
  threads: CommentThread[] | null;
  hiddenIds: ReadonlyMap<number, number | null>;
  hiddenReplyCounts: ReadonlyMap<number, number>;
  /** Remembers a hidden reply's thread (older stored entries lack it). */
  resolveHidden: (id: number, parentId: number | null) => void;
  reply: ReplyTarget | null;
  cancelReply: () => void;
  /** The web input's draft (the app keeps its own and follows `cleared`). */
  draft: string;
  setDraft: (draft: string) => void;
  /** Moves whenever the draft is cleared (sent, or its reply target disappeared). */
  cleared: number;
  /** Moves when a reply starts; the input should take focus. */
  replyFocus: number;
  /** A comment is being sent. */
  busy: boolean;
  error: string | null;
  /** A server-side hide is being sent. */
  hiding: boolean;
  hideError: string | null;
  writes: CommentWrites;
  /** Sends `text` as a comment, or as a reply to the current target. */
  send: (text: string) => void;
  /** Opens or collapses a thread's replies without altering the current reply target (unless collapsing it). */
  toggleReplies: (item: CommentItem, open: boolean, hasDraft?: boolean) => void;
  /** Focuses the composer targeting `item` as the reply parent. */
  startReply: (item: CommentItem) => boolean;
  hide: (item: CommentItem, parentId: number | null) => void;
  /** Opens the report sheet; absent when the target has no comment reports. */
  report: ((id: number) => void) | undefined;
  /** Web modals of the list (the comment report sheet); CommentsView renders them. */
  dialogs: ReactNode;
};

export function useComments({
  adapter,
  currentUserId,
  canRead = true,
  canWrite = true,
  onChanged,
}: CommentsOptions): CommentsState {
  const { requireLogin } = useLoginPrompt();
  const writable = canWrite && currentUserId !== null;
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { ids: hiddenIds, hide } = useHiddenIds(
    adapter.hide
      ? null
      : `narackrock.hidden-comments.${apiOrigin()}.${userId ?? "guest"}.${adapter.kind}.${adapter.targetId}`,
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
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(linkedParent ? [linkedParent] : []),
  );
  const [linkedThread, setLinkedThread] = useState(linkedParent);
  if (linkedThread !== linkedParent) {
    setLinkedThread(linkedParent);
    if (linkedParent) setExpanded((old) => new Set([...old, linkedParent]));
  }
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [draft, setDraftState] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const setDraft = (value: string) => {
    setDraftState(value);
    if (validationError) setValidationError(null);
  };
  // Moves whenever the draft is cleared, so a draft kept outside (the app's) follows.
  const [cleared, setCleared] = useState(0);
  const [replyFocus, setReplyFocus] = useState(0);
  const clearDraft = () => {
    setDraft("");
    setCleared((value) => value + 1);
  };
  const [hiddenOnServerId, setHiddenOnServerId] = useState<number | null>(null);
  if (hiddenOnServerId !== null) setHiddenOnServerId(null);
  if (
    reply &&
    (hiddenIds.has(reply.commentId) ||
      hiddenIds.has(reply.threadId) ||
      hiddenOnServerId === reply.commentId ||
      hiddenOnServerId === reply.threadId)
  ) {
    setReply(null);
    clearDraft();
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
  const top = useCommentPage(adapter, null, canRead);
  // Writes change counts and threads; every cached thread of the target re-reads from the server.
  const changed = () => {
    void queryClient.invalidateQueries({
      queryKey: commentKeys.target(userId, adapter.kind, adapter.targetId),
    });
    onChanged?.();
  };
  const create = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: number | null }) =>
      adapter.create(text, parentId),
    onSuccess: () => {
      clearDraft();
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
  const writes = useCommentWrites(adapter, currentUserId, changed);
  const busy = create.isPending;
  const toggle = (id: number) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const report = adapter.report;
  const threads =
    top.items
      ?.filter((item) => !hiddenIds.has(item.id))
      .map((item) => ({
        item,
        replyCount: Math.max(0, item.replyCount - (hiddenReplyCounts.get(item.id) ?? 0)),
        expanded: expanded.has(item.id),
      })) ?? null;
  return {
    adapter,
    currentUserId,
    canRead,
    canWrite,
    writable,
    top,
    threads,
    hiddenIds,
    hiddenReplyCounts,
    /** Remembers a hidden reply's thread (older stored entries lack it). */
    resolveHidden: hide,
    reply,
    cancelReply: () => setReply(null),
    draft,
    setDraft,
    cleared,
    /** Moves when a reply starts; the input should take focus. */
    replyFocus,
    busy,
    error:
      validationError ?? (create.isError ? errorText(create.error, "댓글을 등록하지 못했습니다.") : null),
    hiding: hideOnServer.isPending,
    hideError: hideOnServer.isError
      ? errorText(hideOnServer.error, "댓글을 숨기지 못했습니다.")
      : null,
    writes,
    /** Sends `text` as a comment, or as a reply to the current target. */
    send(text: string) {
      if (!requireLogin() || busy || hideOnServer.isPending || !writable) return;
      const sanitized = sanitizeMultiline(text);
      if (!sanitized || !hasVisibleText(sanitized)) return;
      if (codePointLength(sanitized) > COMMENT_MAX_LENGTH) {
        setValidationError(`댓글은 ${COMMENT_MAX_LENGTH}자 이내로 입력해 주세요.`);
        return;
      }
      setValidationError(null);
      create.mutate({ text: sanitized, parentId: reply?.threadId ?? null });
    },
    /** Opens or collapses replies; clears the reply target only if collapsing the active thread. */
    toggleReplies(item: CommentItem, open: boolean) {
      toggle(item.id);
      if (open && reply?.threadId === item.id) setReply(null);
    },
    /** The reply button of a thread without replies; true when the input should take focus. */
    startReply(item: CommentItem) {
      if (!requireLogin() || !writable) return false;
      setReply({ commentId: item.id, threadId: item.id, author: item.author });
      setExpanded((old) => new Set([...old, item.id]));
      setReplyFocus((value) => value + 1);
      return true;
    },
    hide(item: CommentItem, parentId: number | null) {
      if (!adapter.hide) {
        hide(item.id, parentId);
      } else if (!hideOnServer.isPending && requireLogin()) {
        hideOnServer.mutate(item.id);
      }
    },
    report: report
      ? (id: number) => {
          if (requireLogin()) setReportTarget(id);
        }
      : undefined,
    /** Platform-specific report confirmation, mounted by the active comments view. */
    dialogs: (reportTarget !== null && report ? (
      nativeApp() ? (
        <ReportReasons
          onSubmit={(reason, description) => report(reportTarget, reason, description)}
          onDone={() => setReportTarget(null)}
        />
      ) : (
        <FigmaSheet title="신고" onClose={() => setReportTarget(null)}>
          <ReportReasons
            onSubmit={(reason, description) => report(reportTarget, reason, description)}
            onDone={() => setReportTarget(null)}
          />
        </FigmaSheet>
      )
    ) : null) satisfies ReactNode,
  };
}

/**
 * Comment threads for native screens with comments (posts; samples and abyss shorts can reuse them).
 *
 * Web: `useComments(...)` (src/features/comments/use-comments.tsx) owns the comment state the web
 * `CommentsView` draws; `useNativeComments(comments, { onProfile, focus })`
 * (src/features/comments/use-native-comments.tsx) turns that same state into `NativeComments` and
 * returns `act` for `NativeCommentAction`s plus a node (reply loaders) the bridge must render.
 * App: `<Comments model={model.comments} header={...} />` (native/ui/comments.tsx) draws the list,
 * the composer and the comment menus, and sends the actions through `useScreen().act`.
 *
 * A screen with comments puts `comments: NativeComments` in its model, adds `NativeCommentAction`
 * to its action union, and forwards those actions to `act` (`isNativeCommentAction` tells them apart).
 */

/** One comment card (the web's CommentCard). */
export type NativeComment = {
  id: number;
  userId: number;
  author: string;
  avatarUrl: string | null;
  text: string;
  time: string;
  likes: number;
  dislikes: number;
  isLiked: boolean;
  isDisliked: boolean;
  /** The comment opened from a notification link (`?commentId=`). */
  highlighted: boolean;
  /**
   * Its "댓글 더보기" menu: the author's 수정/삭제 (`edit`), otherwise 신고 (`report`), 숨기기 and the
   * moderator's 삭제 (`moderate`).
   */
  menu: { edit: boolean; report: boolean; moderate: boolean };
  /** Like/dislike are offered (disabled without the capability or while one is sent). */
  canReact: boolean;
  reacting: boolean;
  /** An edit, delete or moderator delete is being sent. */
  busy: boolean;
  /** The last reaction/edit/delete failure. */
  error: string | null;
  /** Successful edits and deletes; the app closes this comment's editor or confirmation when it moves. */
  changed: number;
};

/** The replies of an expanded thread (the web's Replies). */
export type NativeReplies = {
  /** "답글을 불러오는 중..." while null and no error. */
  items: NativeComment[] | null;
  /** Load failure with "다시 시도". */
  error: string | null;
  /** "더보기 (remaining)" / "불러오는 중...". */
  more: { remaining: number; busy: boolean } | null;
};

/** A top-level comment with its reply button and, when expanded, its replies. */
export type NativeCommentThread = {
  comment: NativeComment;
  /** Shown on the reply button; without replies the button starts a reply instead of expanding. */
  replyCount: number;
  expanded: boolean;
  /** Present while expanded with replies. */
  replies: NativeReplies | null;
};

export type NativeComments = {
  /** "댓글을 불러오는 중..." */
  loading: boolean;
  /** Load failure of the top-level list, with "다시 시도". */
  error: string | null;
  /** "첫 댓글을 남겨보세요." */
  empty: boolean;
  threads: NativeCommentThread[];
  /** "댓글 더보기" / "불러오는 중...". */
  more: { busy: boolean } | null;
  /** Comments can be written here (the reply button of a thread without replies stays enabled). */
  canReply: boolean;
  composer: {
    /** Signed out: a login button with this text replaces the input (the send button stays). */
    signedOut: string | null;
    /** The input accepts text (signed in and writing allowed). */
    writable: boolean;
    /** A comment is being sent. */
    busy: boolean;
    /** A server-side hide is being sent; sending waits. */
    hiding: boolean;
    /** "{author}에게 답글" with "답글 취소". */
    replyTo: string | null;
    /** Sending failed; the app keeps its draft and the reply target. */
    error: string | null;
    hideError: string | null;
    /** Moves when the draft must be cleared (sent, or its reply target disappeared). */
    cleared: number;
    /** Moves when the input should take focus (comment button, reply). */
    focus: number;
  };
};

export type NativeCommentAction =
  | { type: "comment-send"; text: string }
  | { type: "comment-login" }
  | { type: "comment-reply"; id: number }
  /** The reply button of a thread with replies; `hasDraft` keeps the reply target as on the web. */
  | { type: "comment-toggle-replies"; id: number; hasDraft: boolean }
  | { type: "comment-cancel-reply" }
  | { type: "comment-vote"; id: number; vote: "like" | "dislike" }
  | { type: "comment-edit"; id: number; text: string }
  | { type: "comment-delete"; id: number }
  | { type: "comment-moderate"; id: number; reason: string }
  | { type: "comment-report"; id: number }
  | { type: "comment-hide"; id: number }
  | { type: "comment-profile"; userId: number }
  | { type: "comments-more" }
  | { type: "comments-retry" }
  | { type: "comment-replies-more"; id: number }
  | { type: "comment-replies-retry"; id: number };

const commentActions: Record<NativeCommentAction["type"], true> = {
  "comment-send": true,
  "comment-login": true,
  "comment-reply": true,
  "comment-toggle-replies": true,
  "comment-cancel-reply": true,
  "comment-vote": true,
  "comment-edit": true,
  "comment-delete": true,
  "comment-moderate": true,
  "comment-report": true,
  "comment-hide": true,
  "comment-profile": true,
  "comments-more": true,
  "comments-retry": true,
  "comment-replies-more": true,
  "comment-replies-retry": true,
};

export function isNativeCommentAction(action: { type: string }): action is NativeCommentAction {
  return Object.hasOwn(commentActions, action.type);
}

/** No comments and no composer input (e.g. a page that failed before its comments exist). */
export const emptyNativeComments: NativeComments = {
  loading: false,
  error: null,
  empty: false,
  threads: [],
  more: null,
  canReply: false,
  composer: {
    signedOut: null,
    writable: false,
    busy: false,
    hiding: false,
    replyTo: null,
    error: null,
    hideError: null,
    cleared: 0,
    focus: 0,
  },
};

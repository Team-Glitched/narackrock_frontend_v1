export type CommentItem = {
  id: number;
  parentId: number | null;
  userId: number;
  author: string;
  avatarUrl: string | null;
  text: string;
  time: string;
  replyCount: number;
  likes: number;
  dislikes: number;
  isLiked: boolean;
  isDisliked: boolean;
};
export type CommentPage = { items: CommentItem[]; total: number; page: number };
export type CommentReaction = Pick<CommentItem, "isLiked" | "isDisliked"> & {
  likeCount: number;
  dislikeCount: number;
};
/** Comment targets; with `targetId` they key the cached comment threads. */
export type CommentKind = "posts" | "sources" | "shorts";
/**
 * Server comment operations. Optional members are capabilities: a target whose backend contract lacks
 * editing, deletion, reactions or reports omits them and the UI does not offer that action.
 */
export type CommentAdapter = {
  kind: CommentKind;
  targetId: number;
  load: (parentId: number | null, page: number, signal?: AbortSignal) => Promise<CommentPage>;
  create: (text: string, parentId: number | null) => Promise<unknown>;
  update?: (id: number, text: string) => Promise<unknown>;
  remove?: (id: number) => Promise<unknown>;
  react?: (id: number, kind: "like" | "dislike") => Promise<CommentReaction>;
  report?: (id: number, reason: string, description: string | null) => Promise<unknown>;
  /** Gallery moderator deletion with a recorded reason (distinct from the author's own delete). */
  moderate?: (id: number, reason: string) => Promise<unknown>;
};

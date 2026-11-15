/** View-model pieces shared by native screens. Plain data only: they travel over the bridge as JSON. */

export type NativeList<T> = { status: "loading" | "error" | "ready"; items: T[] };

/** A list that loads more pages with the `more` action. */
export type NativePagedList<T> = NativeList<T> & {
  hasMore: boolean;
  /** A next page is loading. */
  appending: boolean;
  /** The last next-page load failed; `more` retries it. */
  appendFailed: boolean;
};

export type NativeContentKind = "post" | "short";

export type NativeSong = {
  shortId: number;
  title: string;
  author: string;
  albumImageUrl: string | null;
  ownerId: number;
};

export type NativePost = {
  postId: number;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  writer: { nickname: string; profileImageUrl: string | null };
  ownerId: number;
  createdLabel: string;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
};

/**
 * The page header. `left` is the logo (back to the top of the home), a back button or nothing;
 * `actions` are drawn right to left in this order; `account` is the login button or the avatar.
 */
export type NativeHeader = {
  left: "logo" | "back" | "none";
  title?: string;
  actions: ("notifications" | "chat" | "search" | "account")[];
};
/** Actions every native screen can send; the web handles them the same way on every page. */
export type NativeCommonAction =
  | { type: "back" | "search" | "notifications" | "chat" | "login" | "profile" | "refresh" }
  | { type: "share" | "report"; kind: NativeContentKind; id: number; title: string };

/** Loads the next page of the screen's paged list; handled by the page. */
export type NativeMoreAction = { type: "more" };

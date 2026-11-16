import type { NativeCommunity, NativePerson } from "./common.ts";

/** Native screen types of the social feature; registered in ./index.ts. */

/** A menu item of a feed post card (the web's PostUserActionsMenu). */
export type NativeFeedPostMenuItem =
  | "report"
  | "hide"
  | "edit"
  | "delete"
  | "moderate-delete"
  | "suspend"
  | "expel";

/** Lookup state of the viewer's reaction or bookmark (the web's PostActions status). */
export type NativeLookupStatus = "ready" | "loading" | "unavailable";

/** A full post card of a feed (the web's CommunityPost). */
export type NativeFeedPost = {
  postId: number;
  title: string;
  /** Text under the title (the loaded detail's body, else the list preview). */
  preview: string | null;
  imageUrl: string | null;
  writer: { userId: number; nickname: string; profileImageUrl: string | null };
  createdLabel: string;
  /** Community label next to the title. */
  community: string | null;
  /** Options of the "게시글 더보기" menu; empty while nothing applies. */
  menu: NativeFeedPostMenuItem[];
  likeCount: number;
  /** Null until the viewer's reaction is known (the web shows "‒"). */
  dislikeCount: number | null;
  commentCount: number;
  vote: "like" | "dislike" | null;
  voteStatus: NativeLookupStatus;
  saved: boolean;
  saveStatus: NativeLookupStatus;
  /** A reaction, bookmark or share is being sent. */
  busy: boolean;
  /** An edit, deletion or edit lookup is running; the card's buttons are disabled. */
  submitting: boolean;
  /** Reaction/bookmark/share result or failure under the actions. */
  notice: string | null;
  /** Edit/delete failure. */
  error: string | null;
  /** Result of a member sanction. */
  moderationNotice: string | null;
  /** Inline edit form with the server's current text; null when not editing. */
  editing: { title: string; content: string } | null;
  /** Inline delete confirmation; `moderating` asks for a reason (운영 삭제). */
  confirmDelete: { moderating: boolean } | null;
};

/** A paged feed of post cards. */
export type NativeFeed = {
  status: "loading" | "error" | "ready";
  loadingText: string;
  errorText: string;
  emptyText: string;
  items: NativeFeedPost[];
  hasMore: boolean;
  appending: boolean;
  appendFailed: boolean;
  /** Loads the next page when the end is reached (the web's infinite scroll), besides the button. */
  autoMore: boolean;
  /** "마지막 게시글이에요." under a complete, non-empty list. */
  endNotice: boolean;
};

/** Actions of a feed; handled by the page for the post `postId`. */
export type NativeFeedAction =
  | { type: "feed-retry" }
  | { type: "feed-visible"; postIds: number[] }
  | { type: "post-open"; postId: number }
  | { type: "post-profile"; userId: number }
  | { type: "post-vote"; postId: number; vote: "like" | "dislike" }
  | { type: "post-save" | "post-share"; postId: number }
  | { type: "post-menu"; postId: number; item: NativeFeedPostMenuItem }
  | { type: "post-edit-save"; postId: number; title: string; content: string }
  | { type: "post-edit-cancel" | "post-delete-cancel"; postId: number }
  | { type: "post-delete"; postId: number; reason: string };

/** A message with the web's retry button. */
export type NativeFailure = { message: string; retryLabel: string; retryDisabled: boolean };

/** A list of communities with the web's loading / failure / empty rows. */
export type NativeCommunityList = {
  status: "loading" | "failed" | "empty" | "ready";
  failure: NativeFailure | null;
  emptyText: string;
  items: NativeCommunity[];
};

/** The community tab (the web's CommunityDirectory). */
export type NativeCommunityDirectory = {
  /** "가입한 커뮤니티" rail; null for guests. */
  joined: NativeCommunityList | null;
  /** "추천 커뮤니티"; null when the web hides the section. */
  recommended: NativeCommunityList | null;
  /** Join/leave failure. */
  membershipError: string | null;
};

export type NativeFriend = NativePerson & { instrument: string };

/** A friends section's query state (loading line, error with retry, empty line). */
export type NativeFriendsQuery = {
  loading: string | null;
  failure: NativeFailure | null;
  empty: string | null;
};

export type NativeMutualFriends = NativeFriendsQuery & { people: NativeFriend[] };

export type NativeFollowRequests = NativeFriendsQuery & {
  notice: string | null;
  busy: boolean;
  requests: { requestId: number; person: NativeFriend }[];
};

export type NativeRecommendedPeople = {
  /** Status lines above the list, in the web's order (checking, sync…). */
  checking: string | null;
  outgoingFailure: NativeFailure | null;
  failure: (NativeFailure & { stale: boolean }) | null;
  notice: string | null;
  loading: string | null;
  empty: string | null;
  people: {
    person: NativeFriend;
    label: string;
    accessibilityLabel: string;
    /** Null while the follow state is unknown. */
    pressed: boolean | null;
    tone: "primary" | "secondary";
    disabled: boolean;
  }[];
  /** "더보기" of the full list. */
  more: { disabled: boolean } | null;
};

export type NativeFriendsListKind = "mutual" | "recommendations" | "requests";

/** The friends tab; null sections mean signed out (the web's sign-in notice). */
export type NativeFriends =
  | { signedIn: false; message: string }
  | {
      signedIn: true;
      mutual: NativeMutualFriends;
      recommendations: NativeRecommendedPeople;
      requests: NativeFollowRequests;
    };

export type NativeSocialTab = "posts" | "community" | "friends";

/** /social, /communities and /friends: the tabs and the current tab's content. */
export type NativeSocial = {
  tab: NativeSocialTab;
  posts: NativeFeed | null;
  communities: NativeCommunityDirectory | null;
  friends: NativeFriends | null;
  /** The floating create button (ContextualCreate); null on the friends tab. */
  create: { label: string; accessibilityLabel: string } | null;
};

export type NativeFriendsAction =
  | { type: "sign-in" }
  | { type: "open-profile"; userId: number }
  | { type: "open-chat"; userId: number }
  | { type: "open-friends-list"; kind: NativeFriendsListKind }
  | { type: "mutual-retry" | "requests-retry" | "outgoing-retry" | "recommendations-retry" }
  | { type: "review-request"; requestId: number; decision: "accept" | "reject" }
  | { type: "follow"; userId: number };

export type NativeDirectoryAction =
  | { type: "open-community"; galleryId: number }
  | { type: "toggle-join"; galleryId: number }
  | { type: "open-joined" }
  | { type: "directory-retry" };

export type NativeSocialAction =
  | { type: "tab"; tab: NativeSocialTab }
  /** The header logo (the web's "홈으로"). */
  | { type: "home" }
  | { type: "create" }
  | NativeFeedAction
  | NativeFriendsAction
  | NativeDirectoryAction;

/** /friends/:list: one full friends list. */
export type NativeFriendsList =
  | { kind: NativeFriendsListKind; signedIn: false; message: string }
  | ({ signedIn: true } & (
      | { kind: "mutual"; mutual: NativeMutualFriends }
      | { kind: "requests"; requests: NativeFollowRequests }
      | { kind: "recommendations"; recommendations: NativeRecommendedPeople }
    ));

/** /communities/:galleryId (and the manager's view): community info, join control, posts. */
export type NativeCommunityDetail = {
  community: NativeCommunity;
  /** The manager's "커뮤니티 멤버 관리" button. */
  manage: boolean;
  membershipError: { message: string; retry: boolean; retryDisabled: boolean } | null;
  feed: NativeFeed;
  /** The floating "글쓰기" button; null where the web has none. */
  createLabel: string | null;
};

export type NativeCommunityDetailAction =
  | { type: "toggle-join" | "manage" | "membership-retry" | "create" }
  | NativeFeedAction;

/** A page state in place of the page body (loading, not found, invalid address). */
export type NativePageState = {
  message: string;
  tone: "muted" | "error";
  /** The page's floating create button, when the web shows it beside the state. */
  createLabel: string | null;
};

/** /communities/joined. */
export type NativeJoinedCommunities = {
  title: string;
  joined: NativeCommunityList;
  membershipError: string | null;
};

/** /communities/new: the community proposal form (SocialCreate kind "community"). */
export type NativeCreateCommunity =
  | { signedIn: false; message: string }
  | {
      signedIn: true;
      /** "내 커뮤니티 개설 신청" (MyGalleryProposals); null while hidden. */
      proposals: { submitted: boolean; failed: boolean; items: string[] } | null;
      /** Restoring the draft, or the draft was removed elsewhere: shown instead of the form. */
      blocked: string | null;
      /** The form's text; the app sends every change back (the web saves the draft as you type). */
      title: string;
      content: string;
      busy: boolean;
      draftStatus: string;
      /** Alerts under the draft line, in the web's order. */
      errors: string[];
      /** "앨범 이미지 없이 등록" when a restored picture is missing. */
      keepWithoutImage: boolean;
      canSubmit: boolean;
      submitLabel: string;
      /** Moves when a new empty form replaces the submitted one; the app then resets its text. */
      formKey: number;
    };

export type NativeCreateCommunityAction =
  | { type: "sign-in" }
  | { type: "title" | "content"; value: string }
  | { type: "submit" | "discard" | "keep-without-image" };

export type SocialScreens = {
  social: { model: NativeSocial; action: NativeSocialAction };
  "social-friends-list": { model: NativeFriendsList; action: NativeFriendsAction };
  "social-community": { model: NativeCommunityDetail; action: NativeCommunityDetailAction };
  "social-page-state": { model: NativePageState; action: { type: "create" } };
  "social-joined": { model: NativeJoinedCommunities; action: NativeDirectoryAction };
  "social-create-community": {
    model: NativeCreateCommunity;
    action: NativeCreateCommunityAction;
  };
};

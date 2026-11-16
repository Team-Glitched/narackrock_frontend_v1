/** Native screen types of the profile feature (profile, settings, saved, notifications); registered in ./index.ts. */
import type { NativePerson, NativePost } from "./common.ts";

/** A song card on a profile: cover and title only, as on the web. */
export type NativeProfileSong = { shortId: number; title: string; albumImageUrl: string | null };

/**
 * A song section of the profile (대표 음악, 내 작업물, 내 참가작, 참여한 음악). `all` is where "모두보기"
 * goes: the charts page (`all-works` action) or a sheet listing `songs`.
 */
export type NativeProfileWorks = {
  key: "featured" | "authored" | "participated";
  title: string;
  status: "loading" | "error" | "ready";
  error: string | null;
  songs: NativeProfileSong[];
  /** Shown when ready without songs. */
  emptyMessage: string;
  all: "chart" | "sheet";
};

/** Follow button and chat entry on another user's profile (the web's ProfileRelationActions). */
export type NativeProfileRelation = {
  label: string;
  tone: "primary" | "secondary";
  disabled: boolean;
  /** Following or requested; null while the outgoing requests are unknown. */
  pressed: boolean | null;
  /** Outgoing requests could not be checked; "다시 확인" retries. */
  checkError: string | null;
  chat: boolean;
  /** Last follow change failure. */
  notice: string | null;
};

export type NativeProfileListKind = "followers" | "following" | "articles";

/** The followers / following / posts sheet (the web's ProfileListSheet). */
export type NativeProfileList = {
  kind: NativeProfileListKind;
  title: string;
  /** "전체" / "맞팔로우" filter of the viewer's own followers. */
  filter: { value: "all" | "mutual"; mutualDisabled: boolean } | null;
  mutualChecking: boolean;
  mutualError: string | null;
  loading: boolean;
  error: string | null;
  /** Retry button under `error`. */
  retry: boolean;
  people: (NativePerson & { instrument: string })[];
  posts: NativePost[];
  emptyMessage: string | null;
};

/** /profile and /users/:userId. */
export type NativeProfile = {
  status: "loading" | "error" | "ready";
  /** Loading or error text. */
  message: string;
  own: boolean;
  user: {
    userId: number;
    nickname: string;
    profileImageUrl: string | null;
    followers: string;
    following: string;
    posts: string;
    instruments: string[];
    explanation: string;
  } | null;
  relation: NativeProfileRelation | null;
  sections: NativeProfileWorks[];
  list: NativeProfileList | null;
};

export type NativeProfileAction =
  | { type: "edit" }
  | { type: "follow" | "recheck-follow" | "chat" }
  | { type: "open-list"; kind: NativeProfileListKind }
  | { type: "close-list" | "list-retry" | "mutual-retry" }
  | { type: "list-filter"; filter: "all" | "mutual" }
  | { type: "all-works"; section: NativeProfileWorks["key"] }
  | { type: "works-retry" }
  | { type: "open-short"; shortId: number }
  | { type: "open-post"; postId: number }
  | { type: "open-profile"; userId: number };

/** /profile/edit (EditProfileScreen and its ProfileForm). */
export type NativeEditProfile = {
  status: "loading" | "error" | "ready";
  message: string;
  /** Initial field values; the app keeps the edited text and sends it with `save`. */
  initial: {
    userId: number;
    nickname: string;
    instrument: string;
    explanation: string;
    imageUrl: string | null;
  } | null;
  /** Small data URL preview of the picked photo. */
  imagePreview: string | null;
  privacy: { isPrivate: boolean; busy: boolean; error: string | null } | null;
  saving: boolean;
  error: string | null;
  submitLabel: string;
};

export type NativeEditProfileAction =
  | { type: "pick-image" | "open-privacy-policy" }
  | { type: "privacy"; value: boolean }
  | { type: "save"; nickname: string; instrument: string; explanation: string };

/** /profile/likes. */
export type NativeLikedPosts = {
  status: "loading" | "error" | "ready";
  error: string | null;
  /** Some posts are hidden for lack of access. */
  forbidden: boolean;
  posts: NativePost[];
  empty: { message: string; disabled: boolean } | null;
  failed: { count: number; disabled: boolean } | null;
  more: { busy: boolean } | null;
};

export type NativeLikedPostsAction =
  | { type: "retry" | "reload" | "retry-failed" }
  | { type: "open-post"; postId: number };

export type NativeSettingsItem = { path: string; label: string; description: string };

/** /settings. */
export type NativeSettings = {
  muted: boolean;
  groups: { title: string; items: NativeSettingsItem[] }[];
};

export type NativeSettingsAction =
  | { type: "mute"; value: boolean }
  | { type: "open"; path: string }
  | { type: "logout" | "migration" };

/** A block of the privacy policy; `email` ends the paragraph with a mailto link. */
export type NativePrivacyBlock = { p: string; email?: string } | { ul: string[] };

/** /privacy. */
export type NativePrivacy = {
  eyebrow: string;
  title: string;
  intro: string;
  effective: string;
  sections: { title: string; blocks: NativePrivacyBlock[] }[];
  closing: string;
};

export type NativePrivacyAction = { type: "home" };

export type NativeSavedItem = {
  id: number;
  title: string;
  author: string;
  imageUrl: string | null;
};

/** /saved. */
export type NativeSaved = {
  status: "signed-out" | "loading" | "ready";
  kind: "post" | "song";
  /** Unsave failure. */
  error: string | null;
  items: NativeSavedItem[];
  empty: boolean;
  /** Item whose option menu is open. */
  menu: number | null;
  /** An unsave is in flight. */
  busy: boolean;
  /** A next page is loading. */
  listBusy: boolean;
  listError: { message: string; retry: boolean } | null;
  more: boolean;
};

export type NativeSavedAction =
  | { type: "kind"; kind: "post" | "song" }
  | { type: "menu" | "unsave" | "open"; id: number }
  | { type: "sign-in" };

export type NativeNotificationItem = {
  /** Id of the group's first notification. */
  id: number;
  title: string;
  /** "N명" for grouped reactions. */
  countLabel: string | null;
  unread: boolean;
  time: string;
  body: string;
  /** "전체 트랙 보기" (project) or "자세히 보기" (detail). */
  link: "project" | "detail" | null;
  /** Accept / decline buttons. */
  pending: boolean;
  statusLabel: string | null;
};

export type NativeNotificationPreferences = {
  status: "loading" | "error" | "ready";
  options: { key: string; title: string; description: string; value: boolean }[];
  saving: boolean;
  saved: boolean;
  failed: boolean;
};

/** /notifications (NotificationsScreen). */
export type NativeNotifications = {
  signedIn: boolean;
  unreadCount: number;
  /** Preferences panel, when opened. */
  preferences: NativeNotificationPreferences | null;
  categories: { id: string | null; label: string }[];
  category: string | null;
  unreadOnly: boolean;
  readAllDisabled: boolean;
  error: string | null;
  notice: string | null;
  status: "loading" | "error" | "ready";
  items: NativeNotificationItem[];
  emptyMessage: string;
  busy: boolean;
  paging: { busy: boolean } | null;
};

export type NativeNotificationsAction =
  | { type: "category"; id: string | null }
  | { type: "unread-only" | "read-all" | "toggle-preferences" | "preferences-retry" | "retry" }
  | { type: "preference"; key: string; value: boolean }
  | { type: "open" | "read" | "project"; id: number }
  | { type: "review"; id: number; accept: boolean };

export type ProfileScreens = {
  "profile-view": { model: NativeProfile; action: NativeProfileAction };
  "profile-edit": { model: NativeEditProfile; action: NativeEditProfileAction };
  "profile-likes": { model: NativeLikedPosts; action: NativeLikedPostsAction };
  "profile-settings": { model: NativeSettings; action: NativeSettingsAction };
  "profile-privacy": { model: NativePrivacy; action: NativePrivacyAction };
  "profile-saved": { model: NativeSaved; action: NativeSavedAction };
  "profile-notifications": { model: NativeNotifications; action: NativeNotificationsAction };
};

/**
 * Native screens: the app draws a page natively while the web page keeps owning its data (session,
 * queries, local stores) and its actions (navigation, login checks, web sheets). Each web page with a
 * native screen reports a view model for its history entry; the app draws it and sends actions back.
 * Add a screen by adding its model/action types to its feature file (e.g. ./social.ts `SocialScreens`)
 * and its component to that feature's registry (native/screens/<feature>/index.tsx).
 */
import type { AbyssScreens } from "./abyss.ts";
import type { AdminScreens } from "./admin.ts";
import type { AuthScreens } from "./auth.ts";
import type { ChatScreens } from "./chat.ts";
import type { NativeCommonAction, NativeHeader, NativeMoreAction } from "./common.ts";
import type { CreationScreens } from "./creation.ts";
import type { EditorScreens } from "./editor.ts";
import type { NativeHome, NativeHomeAction } from "./home.ts";
import type {
  NativeCharts,
  NativeChartsAction,
  NativePostList,
  NativePostListAction,
  NativeSearch,
  NativeSearchAction,
} from "./lists.ts";
import type { PostScreens } from "./post.ts";
import type { ProfileScreens } from "./profile.ts";
import type { SocialScreens } from "./social.ts";
import type { SourcesScreens } from "./sources.ts";
import type { StudioScreens } from "./studio.ts";
import type { WorkspaceScreens } from "./workspace.ts";

export type * from "./abyss.ts";
export type * from "./admin.ts";
export type * from "./auth.ts";
export type * from "./chat.ts";
export type * from "./common.ts";
export type * from "./creation.ts";
export type * from "./editor.ts";
export type * from "./home.ts";
export type * from "./lists.ts";
export type * from "./post.ts";
export type * from "./profile.ts";
export type * from "./social.ts";
export type * from "./sources.ts";
export type * from "./studio.ts";
export type * from "./workspace.ts";

/** Feature → its screens (kind → model and screen-specific actions). Kinds are unique across features. */
export type NativeFeatureScreens = {
  lists: {
    home: { model: NativeHome; action: NativeHomeAction };
    charts: { model: NativeCharts; action: NativeChartsAction };
    posts: { model: NativePostList; action: NativePostListAction };
    search: { model: NativeSearch; action: NativeSearchAction };
  };
  post: PostScreens;
  social: SocialScreens;
  sources: SourcesScreens;
  profile: ProfileScreens;
  auth: AuthScreens;
  workspace: WorkspaceScreens;
  abyss: AbyssScreens;
  chat: ChatScreens;
  admin: AdminScreens;
  studio: StudioScreens;
  editor: EditorScreens;
  creation: CreationScreens;
};

export type NativeFeature = keyof NativeFeatureScreens;

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

/** Screen kind → the page's view model and the screen-specific actions it handles. */
export type NativeScreens = UnionToIntersection<NativeFeatureScreens[NativeFeature]>;
export type NativeScreenKind = keyof NativeScreens;

/**
 * Screen actions must not reuse a common action's type: `useNativeScreen` handles common actions
 * first, so a screen action named like one never reaches its page (a profile's "chat" opened the
 * chat list instead of the conversation). The type below fails to compile on such a collision.
 */
type CollidingActionTypes = Extract<
  NativeScreens[NativeScreenKind]["action"]["type"],
  NativeCommonAction["type"] | NativeMoreAction["type"]
>;
const screenActionsDoNotCollide: [CollidingActionTypes] extends [never]
  ? true
  : CollidingActionTypes = true;
void screenActionsDoNotCollide;

export type NativeScreenView = {
  [K in NativeScreenKind]: {
    kind: K;
    model: NativeScreens[K]["model"];
    header: NativeHeader | null;
    /** Completed `refresh` actions; the app ends its pull-to-refresh spinner when this moves. */
    refreshed: number;
  };
}[NativeScreenKind];

export type NativeScreenAction<K extends NativeScreenKind = NativeScreenKind> =
  | NativeScreens[K]["action"]
  | NativeCommonAction
  | NativeMoreAction;

/**
 * A page's screen for one history entry (react-router `location.key`). `view` is null when the page
 * left the screen; the app keeps the last view of recent entries mounted so Back restores them with
 * their scroll position.
 */
export type NativeScreenReport = { key: string; view: NativeScreenView | null };

/** app → web window event detail: an action on the screen of history entry `key`. */
export type NativeScreenActionEvent = { key: string; action: NativeScreenAction };

/** Signed-in user and header badges, shared by every screen. */
export type NativeSession = {
  userId: number | null;
  profileImageUrl: string | null;
  unreadNotifications: number;
  unreadChats: number;
};

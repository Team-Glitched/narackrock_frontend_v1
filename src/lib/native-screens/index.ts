/**
 * Native screens: the app draws a page natively while the web page keeps owning its data (session,
 * queries, local stores) and its actions (navigation, login checks, web sheets). Each web page with a
 * native screen reports a view model for its history entry; the app draws it and sends actions back.
 * Add a screen by adding its model/action types here and its component to native/screens/index.tsx.
 */
import type { NativeCommonAction, NativeHeader, NativeMoreAction } from "./common.ts";
import type { NativeHome, NativeHomeAction } from "./home.ts";

export type * from "./common.ts";
export type * from "./home.ts";

/** Screen kind → the page's view model and the screen-specific actions it handles. */
export type NativeScreens = {
  home: { model: NativeHome; action: NativeHomeAction };
};

export type NativeScreenKind = keyof NativeScreens;

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

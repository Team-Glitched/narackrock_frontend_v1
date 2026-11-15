/**
 * Wire protocol between the web app (src/lib/native-app.ts) and the React Native shell
 * (native/bridge.ts, native/App.tsx). Types only: `native/` imports it with `import type`, so
 * Metro never bundles this file while both sides are type-checked against the same contract.
 *
 * - The shell appends `NarackrockApp/<platform>` to the WebView user agent (present from the
 *   first request, unlike injected scripts whose timing Android does not guarantee).
 * - The shell injects a per-launch token into the main frame only; requests without it are ignored,
 *   so third-party frames cannot call native features.
 * - web → app: `ReactNativeWebView.postMessage(JSON.stringify(BridgeRequest))`
 * - app → web: `window.__narackrockNativeReceive(BridgeResponse)`; app state changes are dispatched
 *   as the `narackrock:app-background` window event, native footer presses as `narackrock:footer-press`
 *   and native home actions as `narackrock:home-action`.
 * - Native screens are views over the web: the web page keeps owning data (session, queries, local
 *   stores) and reports a plain view model; the app draws it and sends user actions back.
 */
export type NativePlatform = "android" | "ios";

export type NativeUserAgentToken = `NarackrockApp/${NativePlatform}`;

export type BridgeGlobals = {
  token: "__narackrockBridgeToken";
  receive: "__narackrockNativeReceive";
};

export type AppBackgroundEvent = "narackrock:app-background";

/** Footer tabs; the app draws them natively over the web footer, which stays rendered but inert. */
export type NativeFooterTab = "home" | "abyss" | "social" | "opensource";

/** A footer tab or the center create button. */
export type NativeFooterPress = NativeFooterTab | "create";

/** The footer of the page on screen. */
export type NativeFooter = { activeTab: NativeFooterTab | null; createLabel: string };

/** app → web window event; its `detail` is the pressed `NativeFooterPress`. */
export type FooterPressEvent = "narackrock:footer-press";

/** Song card on the native home. */
export type NativeSong = {
  shortId: number;
  title: string;
  author: string;
  albumImageUrl: string | null;
  ownerId: number;
};

/** Popular post row on the native home. */
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

/** Unfinished work opened on this device; `preview` holds up to 4 tracks of clips as fractions of the arrangement. */
export type NativeWork = {
  id: number;
  shortId: number | null;
  title: string;
  visitedLabel: string | null;
  layerCount: number;
  bpm: number;
  preview: { start: number; length: number }[][];
};

export type NativeList<T> = { status: "loading" | "error" | "ready"; items: T[] };

/** View model of the web home page; personal sections are null for guests. */
export type NativeHome = {
  userId: number | null;
  profileImageUrl: string | null;
  unreadNotifications: number;
  unreadChats: number;
  works: { loading: boolean; error: string | null; items: NativeWork[] } | null;
  popular: NativeList<NativeSong>;
  recommended: NativeList<NativeSong>;
  posts: NativeList<NativePost>;
  mine: NativeList<NativeSong> | null;
  /** Completed `refresh` actions; the app ends its pull-to-refresh spinner when this moves. */
  refreshed: number;
};

export type NativeContentKind = "post" | "short";

/** What the user did on the native home; the web performs it (navigation, login checks, sheets). */
export type NativeHomeAction =
  | { type: "open-short"; shortId: number }
  | { type: "open-post"; postId: number }
  | { type: "show-songs"; kind: "popular" | "recommended" | "mine" }
  | { type: "resume"; projectId: number; shortId: number | null }
  | { type: "share" | "report"; kind: NativeContentKind; id: number; title: string }
  | {
      type:
        | "open-posts"
        | "open-workspace"
        | "start-song"
        | "search"
        | "notifications"
        | "chat"
        | "login"
        | "profile"
        | "refresh";
    };

/** app → web window event; its `detail` is a `NativeHomeAction`. */
export type HomeActionEvent = "narackrock:home-action";

export type GoogleSignInResult = { idToken: string } | { cancelled: true };

/** Request type → payload sent by the web and result returned by the app. */
export type BridgeMethods = {
  "google-sign-in": { payload: { webClientId: string }; result: GoogleSignInResult };
  /** The page's footer appeared or changed; null when it left the screen. */
  "set-footer": { payload: { footer: NativeFooter | null }; result: null };
  /** The web home's view model while it is on screen; null when it left. */
  "set-home": { payload: { home: NativeHome | null }; result: null };
  /** Whether a web modal (aria-modal) is open; native views above the WebView step aside for it. */
  "set-modal": { payload: { open: boolean }; result: null };
  /** Native share sheet (the WebView has no Web Share API). */
  "share": { payload: { title: string; url: string }; result: { shared: boolean } };
};

export type BridgeMethod = keyof BridgeMethods;

export type BridgeRequest<M extends BridgeMethod = BridgeMethod> = M extends BridgeMethod
  ? { id: number; token: string; type: M } & BridgeMethods[M]["payload"]
  : never;

export type BridgeErrorCode = "UNSUPPORTED" | "NOT_CONFIGURED" | (string & {});

export type BridgeResponse =
  | { id: number; ok: true; result: BridgeMethods[BridgeMethod]["result"] }
  | { id: number; ok: false; code?: BridgeErrorCode; message: string };

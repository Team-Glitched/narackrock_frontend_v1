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
 *   and native screen actions as `narackrock:screen-action`.
 * - Native screens are views over the web (see ./native-screens/index.ts).
 */
import type { NativeScreenReport, NativeSession } from "./native-screens/index.ts";

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

/** app → web window event; its `detail` is a `NativeScreenActionEvent`. */
export type ScreenActionEvent = "narackrock:screen-action";

export type GoogleSignInResult = { idToken: string } | { cancelled: true };

/** Request type → payload sent by the web and result returned by the app. */
export type BridgeMethods = {
  "google-sign-in": { payload: { webClientId: string }; result: GoogleSignInResult };
  /** The page's footer appeared or changed; null when it left the screen. */
  "set-footer": { payload: { footer: NativeFooter | null }; result: null };
  /** A page's native screen appeared, changed or left (see `NativeScreenReport`). */
  "set-screen": { payload: { screen: NativeScreenReport }; result: null };
  /** The signed-in user and header badges; sent whenever they change. */
  "set-session": { payload: { session: NativeSession }; result: null };
  /** Whether a web modal (aria-modal) is open; native views above the WebView step aside for it. */
  "set-modal": { payload: { open: boolean }; result: null };
  /**
   * Whether the SPA has an earlier entry to return to (react-router's history index). The app's
   * back button uses this and `history.back()`: WebView.canGoBack() skips entries pushed without a
   * user gesture in the page, which is every navigation started from a native view.
   */
  "set-history": { payload: { canGoBack: boolean }; result: null };
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

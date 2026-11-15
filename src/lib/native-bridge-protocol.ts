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
 *   as the `narackrock:app-background` window event, native footer presses as `narackrock:footer-press`.
 */
export type NativePlatform = "android" | "ios";

export type NativeUserAgentToken = `NarackrockApp/${NativePlatform}`;

export type BridgeGlobals = {
  token: "__narackrockBridgeToken";
  receive: "__narackrockNativeReceive";
};

export type AppBackgroundEvent = "narackrock:app-background";

/** Footer tabs; the app draws them natively over the web footer, which stays as a layout placeholder. */
export type NativeFooterTab = "home" | "abyss" | "social" | "opensource";

/** A footer tab or the center create button. */
export type NativeFooterPress = NativeFooterTab | "create";

/** The footer of the page on screen. */
export type NativeFooter = { activeTab: NativeFooterTab | null; createLabel: string };

/** app → web window event; its `detail` is the pressed `NativeFooterPress`. */
export type FooterPressEvent = "narackrock:footer-press";

export type GoogleSignInResult = { idToken: string } | { cancelled: true };

/** Request type → payload sent by the web and result returned by the app. */
export type BridgeMethods = {
  "google-sign-in": { payload: { webClientId: string }; result: GoogleSignInResult };
  /** The page's footer appeared or changed; null when it left the screen. */
  "set-footer": { payload: { footer: NativeFooter | null }; result: null };
};

export type BridgeMethod = keyof BridgeMethods;

export type BridgeRequest<M extends BridgeMethod = BridgeMethod> = M extends BridgeMethod
  ? { id: number; token: string; type: M } & BridgeMethods[M]["payload"]
  : never;

export type BridgeErrorCode = "UNSUPPORTED" | "NOT_CONFIGURED" | (string & {});

export type BridgeResponse =
  | { id: number; ok: true; result: BridgeMethods[BridgeMethod]["result"] }
  | { id: number; ok: false; code?: BridgeErrorCode; message: string };

import type {
  AppBackgroundEvent,
  BridgeGlobals,
  BridgeMethod,
  BridgeMethods,
  BridgeResponse,
  FooterPressEvent,
  NativeFooterPress,
  NativePlatform,
  ScreenActionEvent,
} from "./native-bridge-protocol.ts";
import type { NativeScreenActionEvent } from "./native-screens/index.ts";

/** Bridge to the React Native shell in `native/`; protocol in ./native-bridge-protocol.ts. */
export type NativeAppInfo = { platform: NativePlatform };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __narackrockBridgeToken?: string;
    __narackrockNativeReceive?: (response: BridgeResponse) => void;
  }
}

const receiveGlobal = "__narackrockNativeReceive" satisfies BridgeGlobals["receive"];
const tokenGlobal = "__narackrockBridgeToken" satisfies BridgeGlobals["token"];
const appBackgroundEvent = "narackrock:app-background" satisfies AppBackgroundEvent;
const footerPressEvent = "narackrock:footer-press" satisfies FooterPressEvent;
const screenActionEvent = "narackrock:screen-action" satisfies ScreenActionEvent;

export class NativeRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Null in regular browsers. Read from the user agent, which the shell sets before any script runs. */
export function nativeApp(): NativeAppInfo | null {
  if (typeof navigator === "undefined") return null;
  const platform = /\bNarackrockApp\/(android|ios)\b/.exec(navigator.userAgent)?.[1];
  return platform === "android" || platform === "ios" ? { platform } : null;
}

const pending = new Map<
  number,
  { resolve: (result: unknown) => void; reject: (error: Error) => void }
>();
let nextRequestId = 1;

function receive(response: BridgeResponse): void {
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  if (response.ok) request.resolve(response.result);
  else request.reject(new NativeRequestError(response.message, response.code));
}

export function requestNative<M extends BridgeMethod>(
  type: M,
  payload: BridgeMethods[M]["payload"],
): Promise<BridgeMethods[M]["result"]> {
  const bridge = window.ReactNativeWebView;
  const token = window[tokenGlobal];
  if (!nativeApp() || !bridge || !token)
    return Promise.reject(new NativeRequestError("앱에서만 사용할 수 있는 기능입니다."));
  window[receiveGlobal] ??= receive;
  const id = nextRequestId++;
  // Executor form instead of Promise.withResolvers: older iOS WebViews (< 17.4) lack it.
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (result: unknown) => void, reject });
    bridge.postMessage(JSON.stringify({ ...payload, id, token, type }));
  });
}

/**
 * Runs `listener` when the native app moves to the background, so Web Audio playback can stop.
 * The shell itself pauses `<audio>`/`<video>` elements. No-op in browsers.
 */
export function onAppBackground(listener: () => void): () => void {
  if (!nativeApp()) return () => {};
  window.addEventListener(appBackgroundEvent, listener);
  return () => window.removeEventListener(appBackgroundEvent, listener);
}

/** Runs `listener` with the `detail` of an app → web event. No-op in browsers. */
function onNativeEvent<T>(name: string, listener: (detail: T) => void): () => void {
  if (!nativeApp()) return () => {};
  const handle = (event: Event) => listener((event as CustomEvent<T>).detail);
  window.addEventListener(name, handle);
  return () => window.removeEventListener(name, handle);
}

/** Runs `listener` when the app's native footer is pressed. No-op in browsers. */
export function onFooterPress(listener: (press: NativeFooterPress) => void): () => void {
  return onNativeEvent(footerPressEvent, listener);
}

/** Runs `listener` for user actions on the app's native screens. No-op in browsers. */
export function onScreenAction(listener: (event: NativeScreenActionEvent) => void): () => void {
  return onNativeEvent(screenActionEvent, listener);
}

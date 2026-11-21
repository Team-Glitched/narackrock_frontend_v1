import type {
  AppBackgroundEvent,
  AudioStateEvent,
  BridgeGlobals,
  BridgeMethod,
  BridgeMethods,
  BridgeResponse,
  FooterPressEvent,
  NativeAudioFile,
  NativeAudioState,
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
const audioStateEvent = "narackrock:audio-state" satisfies AudioStateEvent;

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

/** Lets the user pick an image in the platform picker; null when cancelled. App only. */
export async function pickNativeImage(options: { crop?: boolean } = {}): Promise<File | null> {
  const { image } = await requestNative("pick-image", options);
  if (!image) return null;
  const bytes = Uint8Array.from(atob(image.base64), (char) => char.charCodeAt(0));
  return new File([bytes], image.name, { type: image.type });
}

/** Lets the user pick an audio file in the platform file picker; null when cancelled. App only. */
export async function pickNativeAudio(): Promise<File | null> {
  const { audio } = await requestNative("pick-audio", {});
  if (!audio) return null;
  const bytes = Uint8Array.from(atob(audio.base64), (char) => char.charCodeAt(0));
  return new File([bytes], audio.name, { type: audio.type });
}

/** Lets the user pick a JSON note file in the platform file picker; null when cancelled. App only. */
export async function pickNativeJson(): Promise<File | null> {
  const { file } = await requestNative("pick-json", {});
  return file ? nativeAudioToFile(file) : null;
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

/** Runs `listener` for the transport reports of the app's audio engines. No-op in browsers. */
export function onNativeAudioState(listener: (state: NativeAudioState) => void): () => void {
  return onNativeEvent(audioStateEvent, listener);
}

/** A File from audio that crossed the bridge. */
export function nativeAudioToFile(audio: NativeAudioFile): File {
  const bytes = Uint8Array.from(atob(audio.base64), (char) => char.charCodeAt(0));
  return new File([bytes], audio.name, { type: audio.type });
}

/** A File as audio that can cross the bridge. */
export function fileToNativeAudio(file: File): Promise<NativeAudioFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve({
        name: file.name,
        type: file.type,
        base64: url.slice(url.indexOf(",") + 1),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("오디오 파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

/**
 * Saves a generated file: browsers download it; the app opens the share sheet (Save to Files,
 * Drive, …) because the WebView drops blob downloads.
 */
export async function saveFile(file: File): Promise<void> {
  if (nativeApp()) {
    await requestNative("share-file", { file: await fileToNativeAudio(file) });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Microphone recording in the app: `start` asks for the permission and starts (resolves null),
 * `stop` resolves the recording, `cancel` discards it. Native screens draw the live meter.
 */
export async function recordNativeAudio(op: "start" | "stop" | "cancel"): Promise<File | null> {
  const { audio } = await requestNative("audio-record", { op });
  return audio ? nativeAudioToFile(audio) : null;
}

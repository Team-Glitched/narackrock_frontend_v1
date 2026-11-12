/**
 * Bridge to the React Native shell in `native/`. In a regular browser `nativeApp()` is null and
 * nothing here is used. Protocol (mirrored in native/App.tsx):
 * - web → app: `ReactNativeWebView.postMessage(JSON.stringify({ id, type, ...payload }))`
 * - app → web: `window.__narackrockNativeReceive({ id, ok: true, result } | { id, ok: false, code?, message })`
 */
export type NativeAppInfo = { platform: "android" | "ios" };

type NativeResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; code?: string; message: string };

declare global {
  interface Window {
    NarackrockNative?: NativeAppInfo;
    ReactNativeWebView?: { postMessage(message: string): void };
    __narackrockNativeReceive?: (response: NativeResponse) => void;
  }
}

export class NativeRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function nativeApp(): NativeAppInfo | null {
  if (typeof window === "undefined" || !window.ReactNativeWebView) return null;
  return window.NarackrockNative ?? null;
}

const pending = new Map<
  number,
  { resolve: (result: unknown) => void; reject: (error: Error) => void }
>();
let nextRequestId = 1;

function receive(response: NativeResponse): void {
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  if (response.ok) request.resolve(response.result);
  else request.reject(new NativeRequestError(response.message, response.code));
}

export function requestNative<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  const bridge = nativeApp() ? window.ReactNativeWebView : undefined;
  if (!bridge) return Promise.reject(new NativeRequestError("앱에서만 사용할 수 있는 기능입니다."));
  window.__narackrockNativeReceive ??= receive;
  const id = nextRequestId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (result: unknown) => void, reject });
    bridge.postMessage(JSON.stringify({ ...payload, id, type }));
  });
}

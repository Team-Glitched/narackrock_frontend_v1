// Native side of the web ↔ app bridge; the web side is src/lib/native-app.ts.
import { Platform } from "react-native";

import { signInWithGoogle } from "./google-sign-in";

type BridgeRequest = { id: number; type: string; [key: string]: unknown };

export type BridgeResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; code?: string; message: string };

/** Runs before the web app's scripts so `nativeApp()` sees it on first render. */
export const injectedBeforeContentLoaded = `window.NarackrockNative = ${JSON.stringify({ platform: Platform.OS })}; true;`;

/** Script delivering a response to the waiting web request. */
export function responseScript(response: BridgeResponse): string {
  return `window.__narackrockNativeReceive && window.__narackrockNativeReceive(${JSON.stringify(response)}); true;`;
}

export function parseRequest(data: string): BridgeRequest | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      typeof parsed.id === "number" &&
      "type" in parsed &&
      typeof parsed.type === "string"
    )
      return { ...parsed, id: parsed.id, type: parsed.type };
  } catch {
    // Not a bridge message.
  }
  return null;
}

export async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
  try {
    switch (request.type) {
      case "google-sign-in": {
        if (typeof request.webClientId !== "string" || !request.webClientId)
          throw new Error("Google 웹 클라이언트 ID가 없습니다.");
        return { id: request.id, ok: true, result: await signInWithGoogle(request.webClientId) };
      }
      default:
        return {
          id: request.id,
          ok: false,
          code: "UNSUPPORTED",
          message: `지원하지 않는 요청입니다: ${request.type}`,
        };
    }
  } catch (cause) {
    const code =
      cause && typeof cause === "object" && "code" in cause ? String(cause.code) : undefined;
    return {
      id: request.id,
      ok: false,
      code,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

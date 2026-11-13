// Native side of the web ↔ app bridge; the contract is src/lib/native-bridge-protocol.ts and the
// web side is src/lib/native-app.ts.
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

import type {
  AppBackgroundEvent,
  BridgeGlobals,
  BridgeMethod,
  BridgeMethods,
  BridgeRequest,
  BridgeResponse,
  NativeUserAgentToken,
} from "../src/lib/native-bridge-protocol";
import { signInWithGoogle } from "./google-sign-in";

const tokenGlobal = "__narackrockBridgeToken" satisfies BridgeGlobals["token"];
const receiveGlobal = "__narackrockNativeReceive" satisfies BridgeGlobals["receive"];
const appBackgroundEvent = "narackrock:app-background" satisfies AppBackgroundEvent;

/** Appended to the WebView user agent; the web reads it with `nativeApp()`. */
export const userAgentToken: NativeUserAgentToken =
  Platform.OS === "ios" ? "NarackrockApp/ios" : "NarackrockApp/android";

/** Secret for this launch. Injected into the main frame only; cross-origin frames cannot read it. */
export const bridgeToken = randomUUID();

export const injectedBeforeContentLoaded = `window.${tokenGlobal} = ${JSON.stringify(bridgeToken)}; true;`;

/** Pauses page media and lets Web Audio owners stop (see `onAppBackground` in the web). */
export const appBackgroundScript = `document.querySelectorAll("audio, video").forEach(function (media) { media.pause(); });
window.dispatchEvent(new Event(${JSON.stringify(appBackgroundEvent)})); true;`;

/** Script delivering a response to the waiting web request. */
export function responseScript(response: BridgeResponse): string {
  return `window.${receiveGlobal} && window.${receiveGlobal}(${JSON.stringify(response)}); true;`;
}

const handlers: {
  [M in BridgeMethod]: (request: BridgeRequest<M>) => Promise<BridgeMethods[M]["result"]>;
} = {
  "google-sign-in": (request) => signInWithGoogle(request.webClientId),
};

function isMethod(type: string): type is BridgeMethod {
  return Object.hasOwn(handlers, type);
}

/** Null unless `data` is a well-formed request carrying this launch's token. */
export function parseRequest(data: string): BridgeRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("id" in parsed) ||
    typeof parsed.id !== "number" ||
    !("token" in parsed) ||
    parsed.token !== bridgeToken ||
    !("type" in parsed) ||
    typeof parsed.type !== "string" ||
    !isMethod(parsed.type)
  )
    return null;
  if (parsed.type === "google-sign-in") {
    if (!("webClientId" in parsed) || typeof parsed.webClientId !== "string" || !parsed.webClientId)
      return null;
    return {
      id: parsed.id,
      token: bridgeToken,
      type: parsed.type,
      webClientId: parsed.webClientId,
    };
  }
  return null;
}

export async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
  try {
    return { id: request.id, ok: true, result: await handlers[request.type](request) };
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

// Native side of the web ↔ app bridge; the contract is src/lib/native-bridge-protocol.ts and the
// web side is src/lib/native-app.ts.
import { randomUUID } from "expo-crypto";
import { Platform, Share } from "react-native";

import type {
  AppBackgroundEvent,
  BridgeGlobals,
  BridgeMethod,
  BridgeMethods,
  BridgeRequest,
  BridgeResponse,
  FooterPressEvent,
  NativeFooter,
  NativeFooterPress,
  NativeFooterTab,
  NativeUserAgentToken,
  ScreenActionEvent,
} from "../src/lib/native-bridge-protocol";
import type {
  NativeScreenAction,
  NativeScreenActionEvent,
  NativeScreenReport,
  NativeScreenView,
  NativeSession,
} from "../src/lib/native-screens";
import { signInWithGoogle } from "./google-sign-in";
import { pickImage } from "./pick-image";

const tokenGlobal = "__narackrockBridgeToken" satisfies BridgeGlobals["token"];
const receiveGlobal = "__narackrockNativeReceive" satisfies BridgeGlobals["receive"];
const appBackgroundEvent = "narackrock:app-background" satisfies AppBackgroundEvent;
const footerPressEvent = "narackrock:footer-press" satisfies FooterPressEvent;
const screenActionEvent = "narackrock:screen-action" satisfies ScreenActionEvent;

/** Appended to the WebView user agent; the web reads it with `nativeApp()`. */
export const userAgentToken: NativeUserAgentToken =
  Platform.OS === "ios" ? "NarackrockApp/ios" : "NarackrockApp/android";

/** Secret for this launch. Injected into the main frame only; cross-origin frames cannot read it. */
export const bridgeToken = randomUUID();

export const injectedBeforeContentLoaded = `window.${tokenGlobal} = ${JSON.stringify(bridgeToken)}; true;`;

/** Pauses page media and lets Web Audio owners stop (see `onAppBackground` in the web). */
export const appBackgroundScript = `document.querySelectorAll("audio, video").forEach(function (media) { media.pause(); });
window.dispatchEvent(new Event(${JSON.stringify(appBackgroundEvent)})); true;`;

/**
 * Back button while a web modal is open: Escape on the topmost one (on its focused control, so the
 * dialogs' own keydown handlers see it). Every web dialog closes on Escape except the studio's,
 * which stay open rather than losing work.
 */
export const closeModalScript = `(function () {
  var modals = document.querySelectorAll('[aria-modal="true"]');
  var top = modals[modals.length - 1];
  if (!top) return;
  var target = top.contains(document.activeElement) ? document.activeElement : top;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
})(); true;`;

/** Back button otherwise: the SPA's own history (see `set-history` in the bridge protocol). */
export const historyBackScript = "history.back(); true;";

/** Script delivering a response to the waiting web request. */
export function responseScript(response: BridgeResponse): string {
  return `window.${receiveGlobal} && window.${receiveGlobal}(${JSON.stringify(response)}); true;`;
}

/** Script handing a native footer press to the page's footer (see `onFooterPress` in the web). */
export function footerPressScript(press: NativeFooterPress): string {
  return eventScript(footerPressEvent, press);
}

/** Script handing a native screen action to its page (see `useNativeScreen` in the web). */
export function screenActionScript(key: string, action: NativeScreenAction): string {
  return eventScript(screenActionEvent, { key, action } satisfies NativeScreenActionEvent);
}

function eventScript(name: string, detail: unknown): string {
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(name)}, { detail: ${JSON.stringify(detail)} })); true;`;
}

/** What requests need from the screen hosting the WebView. */
export type BridgeHost = {
  setFooter(footer: NativeFooter | null): void;
  setScreen(report: NativeScreenReport): void;
  setSession(session: NativeSession): void;
  setModal(open: boolean): void;
  setCanGoBack(canGoBack: boolean): void;
};

const footerTabs: readonly unknown[] = [
  "home",
  "abyss",
  "social",
  "opensource",
] satisfies NativeFooterTab[];

/** The footer in a `set-footer` payload, or undefined when malformed. */
function readFooter(value: unknown): NativeFooter | null | undefined {
  if (value === null) return null;
  if (
    !value ||
    typeof value !== "object" ||
    !("activeTab" in value) ||
    (value.activeTab !== null && !footerTabs.includes(value.activeTab)) ||
    !("createLabel" in value) ||
    typeof value.createLabel !== "string"
  )
    return undefined;
  return { activeTab: value.activeTab as NativeFooterTab | null, createLabel: value.createLabel };
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
    !("type" in parsed)
  )
    return null;
  const { id } = parsed;
  switch (parsed.type) {
    case "google-sign-in":
      if (
        !("webClientId" in parsed) ||
        typeof parsed.webClientId !== "string" ||
        !parsed.webClientId
      )
        return null;
      return { id, token: bridgeToken, type: parsed.type, webClientId: parsed.webClientId };
    case "set-footer": {
      const footer = "footer" in parsed ? readFooter(parsed.footer) : undefined;
      return footer === undefined ? null : { id, token: bridgeToken, type: parsed.type, footer };
    }
    // View models are typed by the shared protocol rather than re-validated field by field: they
    // only come from the token-holding main frame and only feed Text, image URIs and ids that go
    // back to the same page.
    case "set-screen": {
      const screen = "screen" in parsed ? parsed.screen : null;
      if (
        !screen ||
        typeof screen !== "object" ||
        !("key" in screen) ||
        typeof screen.key !== "string" ||
        !("view" in screen) ||
        typeof screen.view !== "object"
      )
        return null;
      const view = screen.view as NativeScreenView | null;
      return { id, token: bridgeToken, type: parsed.type, screen: { key: screen.key, view } };
    }
    case "set-session":
      if (!("session" in parsed) || !parsed.session || typeof parsed.session !== "object")
        return null;
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        session: parsed.session as NativeSession,
      };
    case "set-modal":
      if (!("open" in parsed) || typeof parsed.open !== "boolean") return null;
      return { id, token: bridgeToken, type: parsed.type, open: parsed.open };
    case "set-history":
      if (!("canGoBack" in parsed) || typeof parsed.canGoBack !== "boolean") return null;
      return { id, token: bridgeToken, type: parsed.type, canGoBack: parsed.canGoBack };
    case "share":
      if (
        !("title" in parsed) ||
        typeof parsed.title !== "string" ||
        !("url" in parsed) ||
        typeof parsed.url !== "string" ||
        !/^https?:\/\//.test(parsed.url)
      )
        return null;
      return { id, token: bridgeToken, type: parsed.type, title: parsed.title, url: parsed.url };
    case "pick-image":
      return { id, token: bridgeToken, type: parsed.type };
    default:
      return null;
  }
}

async function run(
  request: BridgeRequest,
  host: BridgeHost,
): Promise<BridgeMethods[BridgeMethod]["result"]> {
  switch (request.type) {
    case "google-sign-in":
      return signInWithGoogle(request.webClientId);
    case "set-footer":
      host.setFooter(request.footer);
      return null;
    case "set-screen":
      host.setScreen(request.screen);
      return null;
    case "set-session":
      host.setSession(request.session);
      return null;
    case "set-modal":
      host.setModal(request.open);
      return null;
    case "set-history":
      host.setCanGoBack(request.canGoBack);
      return null;
    case "share": {
      // Android shares `message` (the link); iOS also takes `url` for rich previews.
      const { action } = await Share.share(
        { title: request.title, message: request.url, url: request.url },
        { dialogTitle: request.title },
      );
      return { shared: action === Share.sharedAction };
    }
    case "pick-image":
      return { image: await pickImage() };
  }
}

export async function handleRequest(
  request: BridgeRequest,
  host: BridgeHost,
): Promise<BridgeResponse> {
  try {
    return { id: request.id, ok: true, result: await run(request, host) };
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

// Native side of the web ↔ app bridge; the contract is src/lib/native-bridge-protocol.ts and the
// web side is src/lib/native-app.ts.
import { randomUUID } from "expo-crypto";
import { Platform, Share } from "react-native";

import type { MidiNoteDto } from "../src/lib/api/composition";
import type {
  AppBackgroundEvent,
  AudioStateEvent,
  BridgeGlobals,
  BridgeMethod,
  BridgeMethods,
  BridgeRequest,
  BridgeResponse,
  FooterPressEvent,
  NativeAudioCommand,
  NativeAudioState,
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
import {
  nativeDialogEvent,
  type NativeDialogAction,
  type NativeDialogEvent,
  type NativeDialogReport,
} from "../src/lib/native-dialog";
import { record, renderNotes, runAudioCommand } from "./audio";
import { signInWithGoogle } from "./google-sign-in";
import { pickImage } from "./pick-image";
import { pickAudio } from "./pick-audio";
import { pickJson } from "./pick-json";
import { shareFile } from "./share-file";

const tokenGlobal = "__narackrockBridgeToken" satisfies BridgeGlobals["token"];
const receiveGlobal = "__narackrockNativeReceive" satisfies BridgeGlobals["receive"];
const appBackgroundEvent = "narackrock:app-background" satisfies AppBackgroundEvent;
const footerPressEvent = "narackrock:footer-press" satisfies FooterPressEvent;
const screenActionEvent = "narackrock:screen-action" satisfies ScreenActionEvent;
const audioStateEvent = "narackrock:audio-state" satisfies AudioStateEvent;

/** Appended to the WebView user agent; the web reads it with `nativeApp()`. */
export const userAgentToken: NativeUserAgentToken =
  Platform.OS === "ios" ? "NarackrockApp/ios" : "NarackrockApp/android";

/** Secret for this launch. Injected into the main frame only; cross-origin frames cannot read it. */
export const bridgeToken = randomUUID();

/**
 * Runs at the start of every main-frame document, before page scripts: hands the page this launch's
 * token and tells the app a new document started (`document-start`). Both platforms define
 * `ReactNativeWebView` before this script.
 */
export const injectedBeforeContentLoaded = `window.${tokenGlobal} = ${JSON.stringify(bridgeToken)};
if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(${JSON.stringify(
  JSON.stringify({ id: 0, token: bridgeToken, type: "document-start" }),
)}); true;`;

/** Pauses page media and lets Web Audio owners stop (see `onAppBackground` in the web). */
export const appBackgroundScript = `document.querySelectorAll("audio, video").forEach(function (media) { media.pause(); });
window.dispatchEvent(new Event(${JSON.stringify(appBackgroundEvent)})); true;`;

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

export function dialogActionScript(id: string, action: NativeDialogAction): string {
  return eventScript(nativeDialogEvent, { id, action } satisfies NativeDialogEvent);
}

/** Script reporting an audio engine's transport to the web (see `onNativeAudioState`). */
export function audioStateScript(state: NativeAudioState): string {
  return eventScript(audioStateEvent, state);
}

function eventScript(name: string, detail: unknown): string {
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(name)}, { detail: ${JSON.stringify(detail)} })); true;`;
}

/** What requests need from the screen hosting the WebView. */
export type BridgeHost = {
  /** The local web server's origin: relative media and sample URLs resolve against it. */
  origin: string;
  setFooter(footer: NativeFooter | null): void;
  setScreen(report: NativeScreenReport): void;
  setSession(session: NativeSession): void;
  setDialog(dialog: NativeDialogReport): void;
  setCanGoBack(canGoBack: boolean): void;
  /** A new document started: the previous document's audio scopes end. */
  documentStart(): void;
};

const footerTabs: readonly unknown[] = [
  "home",
  "abyss",
  "social",
  "opensource",
] satisfies NativeFooterTab[];

const audioCommands: readonly unknown[] = [
  "load",
  "mix",
  "play",
  "pause",
  "seek",
  "preview-notes",
  "preview-audio",
  "stop-preview",
  "dispose",
] satisfies NativeAudioCommand["type"][];

const recordOps: readonly unknown[] = [
  "start",
  "stop",
  "cancel",
] satisfies BridgeMethods["audio-record"]["payload"]["op"][];

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
    case "document-start":
      return { id, token: bridgeToken, type: parsed.type };
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
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        screen: { key: screen.key, view, overlay: "overlay" in screen && screen.overlay === true },
      };
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
    case "set-dialog": {
      const dialog = "dialog" in parsed ? parsed.dialog : null;
      if (
        !dialog ||
        typeof dialog !== "object" ||
        !("id" in dialog) ||
        typeof dialog.id !== "string" ||
        !("model" in dialog) ||
        (dialog.model !== null && typeof dialog.model !== "object")
      )
        return null;
      return { id, token: bridgeToken, type: parsed.type, dialog: dialog as NativeDialogReport };
    }
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
    case "pick-audio":
    case "pick-json":
      return { id, token: bridgeToken, type: parsed.type };
    case "share-file": {
      const file = "file" in parsed ? parsed.file : null;
      if (
        !file ||
        typeof file !== "object" ||
        !("name" in file) ||
        typeof file.name !== "string" ||
        !file.name ||
        !("type" in file) ||
        typeof file.type !== "string" ||
        !("base64" in file) ||
        typeof file.base64 !== "string"
      )
        return null;
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        file: { name: file.name, type: file.type, base64: file.base64 },
      };
    }
    case "pick-image":
      return { id, token: bridgeToken, type: parsed.type };
    // Audio payloads are typed by the shared protocol past their discriminants, like view models:
    // they only come from the token-holding main frame (the web hook builds them).
    case "audio-engine": {
      const command = "command" in parsed ? parsed.command : null;
      if (
        !("engine" in parsed) ||
        typeof parsed.engine !== "string" ||
        !parsed.engine ||
        !command ||
        typeof command !== "object" ||
        !("type" in command) ||
        !audioCommands.includes(command.type)
      )
        return null;
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        engine: parsed.engine,
        command: command as NativeAudioCommand,
      };
    }
    case "audio-render-notes":
      if (
        !("notes" in parsed) ||
        !Array.isArray(parsed.notes) ||
        !("bpm" in parsed) ||
        typeof parsed.bpm !== "number" ||
        !(parsed.bpm > 0)
      )
        return null;
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        notes: parsed.notes as MidiNoteDto[],
        bpm: parsed.bpm,
      };
    case "audio-record":
      if (!("op" in parsed) || !recordOps.includes(parsed.op)) return null;
      return {
        id,
        token: bridgeToken,
        type: parsed.type,
        op: parsed.op as BridgeMethods["audio-record"]["payload"]["op"],
      };
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
    case "document-start":
      host.documentStart();
      return null;
    case "set-footer":
      host.setFooter(request.footer);
      return null;
    case "set-screen":
      host.setScreen(request.screen);
      return null;
    case "set-session":
      host.setSession(request.session);
      return null;
    case "set-dialog":
      host.setDialog(request.dialog);
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
    case "pick-audio":
      return { audio: await pickAudio() };
    case "pick-json":
      return { file: await pickJson() };
    case "share-file":
      await shareFile(request.file);
      return null;
    case "audio-engine":
      await runAudioCommand(host.origin, request.engine, request.command);
      return null;
    case "audio-render-notes":
      return { audio: await renderNotes(host.origin, request.notes, request.bpm) };
    case "audio-record":
      return { audio: await record(request.op) };
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

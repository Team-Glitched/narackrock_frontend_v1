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
import type { MidiNoteDto, TrackDto } from "./api/composition.ts";
import type { NativeScreenReport, NativeSession } from "./native-screens/index.ts";
import type { NativeDialogReport } from "./native-dialog.ts";

export type NativePlatform = "android" | "ios";

export type NativeUserAgentToken = `NarackrockApp/${NativePlatform}`;

export type BridgeGlobals = {
  token: "__narackrockBridgeToken";
  receive: "__narackrockNativeReceive";
};

export type AppBackgroundEvent = "narackrock:app-background";

/** Footer tabs, drawn only by the native app. */
export type NativeFooterTab = "home" | "abyss" | "social" | "opensource";

/** A footer tab or the center create button. */
export type NativeFooterPress = NativeFooterTab | "create";

/** The footer of the page on screen. */
export type NativeFooter = { activeTab: NativeFooterTab | null; createLabel: string };

/** app → web window event; its `detail` is the pressed `NativeFooterPress`. */
export type FooterPressEvent = "narackrock:footer-press";

/** app → web window event; its `detail` is a `NativeScreenActionEvent`. */
export type ScreenActionEvent = "narackrock:screen-action";

/** app → web window event; its `detail` is a `NativeAudioState`. */
export type AudioStateEvent = "narackrock:audio-state";

export type GoogleSignInResult = { idToken: string } | { cancelled: true };

/** An image chosen in the platform picker, as base64 so the web can build a File from it. */
export type NativePickedImage = { name: string; type: string; base64: string };

/** An audio file crossing the bridge as base64: recordings, rendered notes, audio to audition. */
export type NativeAudioFile = { name: string; type: string; base64: string };

/** What a native audio engine plays: the web's `PlaybackComposition` (use-composition-playback.ts). */
export type NativeAudioComposition = {
  project: {
    bpm: number;
    ppq: number;
    maxDurationMs: number;
    timeSignatureNumerator?: number;
    timeSignatureDenominator?: number;
  };
  tracks: TrackDto[];
};

/** Master mute and per-track levels (0–100), as the web hook keeps them; the master is otherwise at unity. */
export type NativeAudioMix = {
  muted: boolean;
  trackVolumes: Record<number, number>;
  mutedTrackIds: number[];
  metronome: boolean;
};

/**
 * One command to the app's audio engine instance `engine` (one per `useCompositionPlayback` scope).
 * Mirrors the web hook: the same timeline, sampler, mixer, metronome and preview rules.
 */
export type NativeAudioCommand =
  | { type: "load"; composition: NativeAudioComposition | null; durationMs: number | null }
  | { type: "mix"; mix: NativeAudioMix }
  | { type: "play"; positionMs: number }
  | { type: "pause" }
  | { type: "seek"; positionMs: number }
  | {
      type: "preview-notes";
      instrumentId: string;
      pitches: number[];
      spacingMs: number;
      durationMs: number;
    }
  | { type: "preview-audio"; audio: NativeAudioFile; startMs: number | null; endMs: number | null }
  | { type: "stop-preview" }
  | { type: "dispose" };

/** app → web: an engine's transport; sent on start, pause, seek, end and about 4 times a second while playing. */
export type NativeAudioState = {
  engine: string;
  playing: boolean;
  positionMs: number;
  /** Playback reached the end (the web hook's `onEnded`). */
  ended: boolean;
};

/** Request type → payload sent by the web and result returned by the app. */
export type BridgeMethods = {
  "google-sign-in": { payload: { webClientId: string }; result: GoogleSignInResult };
  /**
   * A new document started in the WebView (initial load, reload, crash recovery), posted by the
   * app's start-of-document script before any page script runs. Unlike WebView load events it is
   * not sent for SPA history changes, so the app ends the previous document's audio only here.
   */
  "document-start": { payload: Record<never, never>; result: null };
  /** The page's footer appeared or changed; null when it left the screen. */
  "set-footer": { payload: { footer: NativeFooter | null }; result: null };
  /** A page's native screen appeared, changed or left (see `NativeScreenReport`). */
  "set-screen": { payload: { screen: NativeScreenReport }; result: null };
  /** The signed-in user and header badges; sent whenever they change. */
  "set-session": { payload: { session: NativeSession }; result: null };
  /** A data-only native dialog appeared, changed or left. Never exposes web content. */
  "set-dialog": { payload: { dialog: NativeDialogReport }; result: null };
  /**
   * Whether the SPA has an earlier entry to return to (react-router's history index). The app's
   * back button uses this and `history.back()`: WebView.canGoBack() skips entries pushed without a
   * user gesture in the page, which is every navigation started from a native view.
   */
  "set-history": { payload: { canGoBack: boolean }; result: null };
  /** Native share sheet (the WebView has no Web Share API). */
  share: { payload: { title: string; url: string }; result: { shared: boolean } };
  /**
   * The platform photo picker, for native screens (they cannot use a web file input). Null when
   * cancelled. The web turns the result into a File (`pickNativeImage`) and uploads it as usual.
   */
  "pick-image": { payload: { crop?: boolean }; result: { image: NativePickedImage | null } };
  /**
   * The platform document picker limited to audio, for native screens (a web file input cannot be
   * opened from a native tap). Null when cancelled; the web builds a File (`pickNativeAudio`).
   */
  "pick-audio": { payload: Record<never, never>; result: { audio: NativeAudioFile | null } };
  /**
   * The platform document picker for a JSON note file (the piano roll's "이 기기에서 업로드").
   * Null when cancelled; the web builds a File (`pickNativeJson`).
   */
  "pick-json": { payload: Record<never, never>; result: { file: NativeAudioFile | null } };
  /**
   * Exports a generated file (recovery JSON, original audio): the app writes it to its cache and
   * opens the share sheet (Save to Files, Drive, …), since the WebView drops blob downloads.
   */
  "share-file": { payload: { file: NativeAudioFile }; result: null };
  /**
   * The app's audio engine (react-native-audio-api). Resolves once the command took effect; rejects
   * with the web's Korean message when loading or playing fails (missing instrument, bad file, …).
   */
  "audio-engine": { payload: { engine: string; command: NativeAudioCommand }; result: null };
  /** Renders authored notes to a WAV with the sampled MIDI instrument (the web's `renderPianoAudio`). */
  "audio-render-notes": {
    payload: { notes: MidiNoteDto[]; bpm: number; instrumentId?: string };
    result: { audio: NativeAudioFile };
  };
  /**
   * Microphone recording. `start` asks for the permission and starts (null result); `stop` returns
   * the recording; `cancel` discards it.
   */
  "audio-record": {
    payload: { op: "start" | "stop" | "cancel" };
    result: { audio: NativeAudioFile | null };
  };
};

export type BridgeMethod = keyof BridgeMethods;

export type BridgeRequest<M extends BridgeMethod = BridgeMethod> = M extends BridgeMethod
  ? { id: number; token: string; type: M } & BridgeMethods[M]["payload"]
  : never;

export type BridgeErrorCode = "UNSUPPORTED" | "NOT_CONFIGURED" | (string & {});

export type BridgeResponse =
  | { id: number; ok: true; result: BridgeMethods[BridgeMethod]["result"] }
  | { id: number; ok: false; code?: BridgeErrorCode; message: string };

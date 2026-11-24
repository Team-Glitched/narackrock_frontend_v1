import type { AudioTranscriptionMode } from "../api/composition.ts";
/**
 * Native screen types of layer creation (upload, record, piano sketch) and their reusable parts;
 * registered in ./index.ts. The studio's upload/record pages and the sample registration audio steps
 * (/sources/new?stage=…) report the same kinds with their own labels.
 *
 * Reusable part: the audio trim picker (the web's AudioTrimPicker). The web hook
 * `useNativeAudioTrim(file, options)` (src/features/composition/native-audio-trim.tsx) returns
 * `{ model, act, node }`; put `trim: model` in the screen model, forward actions where
 * `isNativeAudioTrimAction(action)` to `act` and render `node`. App: `AudioTrim`
 * (native/screens/creation/trim.tsx).
 */
import type { NativeNoteRoll, NativeNoteRollAction } from "./editor.ts";
import type {
  NativeInstrumentAction,
  NativeInstrumentPicker,
  NativeTimingAction,
  NativeTimingSheet,
  NativeTransport,
  NativeTransportAction,
} from "./studio.ts";

export type NativeCreationMethod = "upload" | "record" | "note";

/** The web's CompositionChoiceScreen (업로드 / 녹음 / 피아노롤 cards). */
export type NativeCreationChoose = { busy: boolean; error: string | null; instrument?: NativeInstrumentPicker | null };

export type NativeCreationChooseAction = { type: "creation-choose"; method: NativeCreationMethod } | NativeInstrumentAction;

/** The web's AudioTrimPicker for one chosen file. */
export type NativeAudioTrim = {
  /** null while the length is read ("오디오 길이를 읽는 중입니다.") or when it could not be read (`error`). */
  durationMs: number | null;
  selection: { startMs: number; endMs: number } | null;
  segments?: { startMs: number; endMs: number }[];
  selectedSegmentIndex?: number;
  canUndo?: boolean;
  edited?: boolean;
  enableSplice?: boolean;
  hideActions?: boolean;
  hidePreviewButton?: boolean;
  bpm?: number;
  timeSignature?: string;
  /** 96 bar heights (0.12–1); null while computing (`waveformFailed` false) or when it failed. */
  peaks: number[] | null;
  waveformFailed: boolean;
  previewing: boolean;
  /** Preview position inside the selection/spliced result; moves while previewing. */
  positionMs: number;
  /** Source waveform cursor position in ms. */
  cursorSourceMs?: number;
  /** Saving ("올리는 중..."). */
  busy: boolean;
  error: string | null;
  saveLabel: string;
  /** Shows the "취소" button. */
  cancel: boolean;
};

export type NativeAudioTrimAction =
  /** The final selection after a drag, handle move or waveform tap (the app applies the web's rules). */
  | { type: "trim-select"; startMs: number; endMs: number }
  /** ▶ / ■ */
  | { type: "trim-preview" }
  /** The "미리 듣기 위치" slider. */
  | { type: "trim-position"; positionMs: number }
  | { type: "trim-cursor"; sourceMs: number }
  | { type: "trim-split" }
  | { type: "trim-delete-segment" }
  | { type: "trim-duplicate-segment" }
  | { type: "trim-select-segment"; index: number }
  | { type: "trim-reorder-segment"; direction: -1 | 1 }
  | { type: "trim-undo" }
  | { type: "trim-reset" }
  | { type: "trim-save" }
  | { type: "trim-cancel" };

const trimActions: Record<NativeAudioTrimAction["type"], true> = {
  "trim-select": true,
  "trim-preview": true,
  "trim-position": true,
  "trim-cursor": true,
  "trim-split": true,
  "trim-delete-segment": true,
  "trim-duplicate-segment": true,
  "trim-select-segment": true,
  "trim-reorder-segment": true,
  "trim-undo": true,
  "trim-reset": true,
  "trim-save": true,
  "trim-cancel": true,
};

export function isNativeAudioTrimAction(action: { type: string }): action is NativeAudioTrimAction {
  return Object.hasOwn(trimActions, action.type);
}

/** The web's CompositionUploadScreen. */
export type NativeCreationUpload = {
  /** The chosen file's name; null shows "업로드 파일 선택". */
  fileName: string | null;
  /** A failed pick or a failed "신규 트랙" cancel. */
  error: string | null;
  trim: NativeAudioTrim | null;
  /** The studio or sample registration's instrument prompt. */
  instrument: NativeInstrumentPicker | null;
  bpm?: number;
  timeSignature?: string;
  timingMode?: "initial" | "editable" | "locked";
  timing?: NativeTimingSheet | null;
};

export type NativeCreationUploadAction =
  | { type: "creation-upload-pick" }
  | NativeAudioTrimAction
  | NativeTimingAction
  | NativeInstrumentAction;

/** The web's CompositionRecordScreen. */
export type NativeCreationRecord = {
  recording: boolean;
  /** Starting, saving or converting: every button is disabled. */
  pending: boolean;
  /** The status line: "녹음 중", the pending label, "녹음 완료" or "". */
  status: string;
  error: string | null;
  /** A finished recording exists (save buttons and the player are shown). */
  recorded: boolean;
  /** The recording's player is playing. */
  previewing: boolean;
  saveLabel: string;
  /** Enables automatic MIDI conversion (studio pages only). */
  transform: boolean;
  soundKind: AudioTranscriptionMode;
  /** A failed "신규 트랙" cancel (studio pages). */
  notice: string | null;
  instrument: NativeInstrumentPicker | null;
  bpm?: number;
  timeSignature?: string;
  timingMode?: "initial" | "editable" | "locked";
  timing?: NativeTimingSheet | null;
  trim?: NativeAudioTrim | null;
};

export type NativeCreationRecordAction =
  | { type: "creation-record-toggle" }
  | { type: "creation-record-retry" }
  | { type: "creation-record-save" }
  | { type: "creation-record-transform" }
  | { type: "creation-record-sound-kind"; kind: AudioTranscriptionMode }
  | { type: "creation-record-preview" }
  | NativeTimingAction
  | NativeAudioTrimAction
  | NativeInstrumentAction;

/** The web's SourcePianoEditor (sample registration "피아노롤"). */
export type NativeCreationPiano = {
  title: string;
  addLabel: string;
  /** Rendering the audio ("오디오를 만드는 중..."): editing, timing and back are disabled. */
  pending: boolean;
  /** The page's, the player's or the editor's error. */
  error: string | null;
  transport: NativeTransport;
  timing: NativeTimingSheet | null;
  roll: NativeNoteRoll;
  instrumentLabel?: string;
  instrumentPicker?: NativeInstrumentPicker | null;
};

export type NativeCreationPianoAction =
  | { type: "creation-piano-back" }
  | { type: "creation-piano-rewind" }
  | { type: "creation-piano-save" }
  | { type: "creation-piano-instrument-open" }
  | NativeTransportAction
  | NativeTimingAction
  | NativeNoteRollAction
  | NativeInstrumentAction;

export type CreationScreens = {
  "creation-choose": { model: NativeCreationChoose; action: NativeCreationChooseAction };
  "creation-upload": { model: NativeCreationUpload; action: NativeCreationUploadAction };
  "creation-record": { model: NativeCreationRecord; action: NativeCreationRecordAction };
  "creation-piano": { model: NativeCreationPiano; action: NativeCreationPianoAction };
};

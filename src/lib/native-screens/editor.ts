/**
 * Native screen types of the note editor (piano roll, drums, chords); registered in ./index.ts.
 *
 * The piano roll is a reusable piece like the studio's (see ./studio.ts): `NativeNoteRoll` is a model
 * field and `NativeNoteRollAction` its action union. The web hook `useNativeNoteRoll`
 * (src/features/composition/use-note-editor-native.ts) returns `{ model, act }` over the web's own
 * `useNoteEditor` controller; pages put `model` in their screen model and forward actions where
 * `isNativeNoteRollAction(action)` to `act`. App: `NoteRoll`, `NoteControls`, `NoteTools` and
 * `NoteRollSheets` in native/screens/editor/roll.tsx.
 */
import type { MidiNoteDto } from "../api/composition.ts";
import type {
  NativeInstrumentAction,
  NativeInstrumentPicker,
  NativeSourcePicker,
  NativeSourcePickerAction,
  NativeTimingAction,
  NativeTimingSheet,
  NativeTransport,
  NativeTransportAction,
} from "./studio.ts";

export type NativeNoteTool = "draw" | "select" | "erase" | "pan";

/** An edit finished in the app (a drawn, moved, resized or erased note group); the web validates it. */
export type NativeNoteEdit =
  | { type: "insert"; notes: MidiNoteDto[] }
  | { type: "delete"; indices: number[] }
  | { type: "move"; indices: number[]; deltaTick: number; deltaRow: number }
  | { type: "resize"; indices: number[]; deltaTick: number };

/** The web's NoteSettingsDialog for one note (length in snap steps, volume = velocity). */
export type NativeNoteSettings = {
  /** Index in `NativeNoteRoll.notes`; sent back with `roll-settings-apply`. */
  index: number;
  note: MidiNoteDto;
  /** The instrument part label beside "Code : …". */
  part: string;
  stepTick: number;
  maxTick: number;
  /** Changes whenever the note may have changed under the open sheet; the app resets its draft then. */
  key: string;
};

export type NativeNoteRoll = {
  /** Native audio engine of the page's playback; the playhead follows `useNativeAudioState(engine)`. */
  engine: string | null;
  /** Committed notes (the app draws its own gesture preview on top). */
  notes: MidiNoteDto[];
  selection: number[];
  /** Accepted change counter; `roll-edit` carries it so stale edits are ignored. */
  revision: number;
  /** Notes can be changed (own draft loaded, not busy, no conflict). */
  editable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasClipboard: boolean;
  /** The editor's last rejection ("같은 음의 노트가 겹칩니다." …). */
  error: string | null;
  tool: NativeNoteTool;
  snapDenominator: 4 | 8 | 16;
  visibleBars: 1 | 2 | 4;
  zoom: number;
  expandedDrums: boolean;
  viewStartTick: number;
  /** Ticks shown across the grid width (visible bars). */
  windowTicks: number;
  /** Clip-local note limit, snap step, pitch range and the shown rows (top to bottom). */
  maxTick: number;
  minPitch: number;
  maxPitch: number;
  stepTick: number;
  rows: number[];
  /** Drum kit: rows are pads with icons, chords are unavailable, the "전체 키트" toggle shows. */
  drum: boolean;
  /** Drum notes on pads hidden by the basic kit. */
  hidden: number;
  ppq: number;
  numerator: number;
  denominator: number;
  /** Clip-local playhead: tick = (positionMs − clipStartMs) / tickMs, clamped to 0…maxTick. */
  tickMs: number;
  clipStartMs: number;
  projectOriginTick?: number;
  suggestion?: { name: string; notes: MidiNoteDto[]; reveal: { pitch: number; sequence?: number } | null };
  /** Coarse clip-local playhead tick (paste and chords insert here). */
  positionTick: number;
  playing: boolean;
  /** Pitch row centered when the roll opens. */
  initialPitch: number;
  /** The "노트 설정" button is offered. */
  canSettings: boolean;
  /** The "코드" button is offered (pitched instruments). */
  canChord: boolean;
  settings: NativeNoteSettings | null;
  /** The chord sheet is open; its error ("기존 노트와 겹칩니다." …). */
  chords: { error: string | null } | null;
};

export type NativeChordLength = "eighth" | "quarter" | "half" | "bar";

export type NativeNoteRollAction =
  | { type: "roll-edit"; revision: number; edit: NativeNoteEdit; audition?: number }
  | { type: "roll-select"; indices: number[]; mode?: "replace" | "toggle" | "add" }
  | { type: "roll-select-all" }
  | { type: "roll-clear-selection" }
  | { type: "roll-copy" }
  | { type: "roll-paste" }
  | { type: "roll-duplicate" }
  | { type: "roll-delete" }
  | { type: "roll-undo" }
  | { type: "roll-redo" }
  | { type: "roll-tool"; tool: NativeNoteTool }
  | { type: "roll-snap"; value: 4 | 8 | 16 }
  | { type: "roll-bars"; value: 1 | 2 | 4 }
  | { type: "roll-drums"; expanded: boolean }
  | { type: "roll-view"; tick: number }
  | { type: "roll-zoom"; zoom: number; tick: number }
  | { type: "roll-audition"; pitch: number }
  /** Clip-local tick. */
  | { type: "roll-seek"; tick: number }
  | { type: "roll-settings-open" }
  | { type: "roll-settings-apply"; index: number; note: MidiNoteDto }
  | { type: "roll-settings-close" }
  | { type: "roll-chords-open" }
  | {
      type: "roll-chord";
      octave: number;
      root: number;
      length: NativeChordLength;
      quality: string;
    }
  | { type: "roll-chords-close" };

const rollActions: Record<NativeNoteRollAction["type"], true> = {
  "roll-edit": true,
  "roll-select": true,
  "roll-select-all": true,
  "roll-clear-selection": true,
  "roll-copy": true,
  "roll-paste": true,
  "roll-duplicate": true,
  "roll-delete": true,
  "roll-undo": true,
  "roll-redo": true,
  "roll-tool": true,
  "roll-snap": true,
  "roll-bars": true,
  "roll-drums": true,
  "roll-view": true,
  "roll-zoom": true,
  "roll-audition": true,
  "roll-seek": true,
  "roll-settings-open": true,
  "roll-settings-apply": true,
  "roll-settings-close": true,
  "roll-chords-open": true,
  "roll-chord": true,
  "roll-chords-close": true,
};

export function isNativeNoteRollAction(action: { type: string }): action is NativeNoteRollAction {
  return Object.hasOwn(rollActions, action.type);
}

/** The "개인 초안을 어떻게 할까요?" dialog shown before leaving an editable layer. */
export type NativeNoteEditorExit = {
  busy: boolean;
  /** "저장 후 나가기" disabled (no draft session or a conflict). */
  saveDisabled: boolean;
  /** "개인 초안 유지" disabled (unsaved changes without a local recovery copy). */
  keepDisabled: boolean;
};

/** /studio/:projectId/tracks/:trackId/notes (the web's NoteEditorScreen, landscape or portrait). */
export type NativeNoteEditor =
  | {
      status: "loading" | "error";
      /** "피아노롤을 불러오는 중입니다.", the load error, or "선택한 MIDI 클립…을 찾을 수 없습니다." */
      message: string;
    }
  | {
      status: "ready";
      /** "<track> · 피아노롤". */
      title: string;
      transport: NativeTransport;
      roll: NativeNoteRoll;
      recommendation?: {
        enabled: boolean;
        panel: { names: string[]; index: number; playing: boolean } | null;
      };
      /** The viewer may change bpm/time signature. */
      timingEditable: boolean;
      timing: NativeTimingSheet | null;
      /** The "악기" button with the current part label; null when the instrument cannot change. */
      instrument: { label: string } | null;
      instrumentPicker: NativeInstrumentPicker | null;
      /** The "샘플 추가" button is offered. */
      canImportSource: boolean;
      sources: NativeSourcePicker | null;
      /** The viewer edits this layer (controls shown); otherwise "내 MIDI 레이어만 수정할 수 있습니다.". */
      editable: boolean;
      /** Draft status line ("변경 없음", "개인 초안 저장됨", notices …); null when read-only. */
      statusText: string | null;
      /** The page's error banner (action, playback, editor or draft error). */
      error: string | null;
      /** "초안 다시 불러오기" is offered. */
      retryLoad: boolean;
      /** Draft conflict actions ("서버본 열기" …). */
      conflict: boolean;
      busy: boolean;
      exit: NativeNoteEditorExit | null;
    };

export type NativeNoteEditorAction =
  | NativeNoteRollAction
  | NativeTransportAction
  | NativeInstrumentAction
  | NativeTimingAction
  | NativeSourcePickerAction
  | { type: "editor-chord-toggle" }
  | { type: "editor-chord-select"; index: number }
  | { type: "editor-chord-reveal" }
  | { type: "editor-chord-listen" }
  | { type: "editor-chord-apply" }
  | { type: "editor-chord-dismiss" }
  | { type: "editor-rewind" }
  | { type: "editor-layers" }
  | { type: "editor-instrument-open" }
  | { type: "editor-retry-load" }
  | { type: "editor-use-server" }
  | { type: "editor-keep-local" }
  | { type: "editor-export" }
  | { type: "editor-exit-save" }
  | { type: "editor-exit-keep" }
  | { type: "editor-exit-discard" }
  | { type: "editor-exit-cancel" };

export type EditorScreens = {
  "editor-notes": { model: NativeNoteEditor; action: NativeNoteEditorAction };
};

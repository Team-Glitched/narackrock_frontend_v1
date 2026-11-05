import type { MidiNoteDto } from "../../lib/api/composition.ts";
import { findInstrument } from "./instrument-catalog.ts";
import { drumPitches } from "./drum-kit.ts";
import { defaultSignature, validSignature, type TimeSignature } from "./time-signature.ts";
import {
  applyNoteEdit, clamp, copyNotes, sameNotes, validSelection, validateNotes,
  type NoteEditBounds, type NoteEditCommand, type NoteEditResult, type NoteEditorSnapshot,
} from "./note-editing.ts";
export type { NoteEditBounds, NoteEditCommand, NoteEditResult, NoteEditorSnapshot } from "./note-editing.ts";

export type NoteHistoryState = {
  past: NoteEditorSnapshot[];
  present: NoteEditorSnapshot;
  future: NoteEditorSnapshot[];
};
export type NoteHistoryAction =
  | { type: "apply"; snapshot: NoteEditorSnapshot }
  | { type: "select"; indices: number[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; snapshot: NoteEditorSnapshot };

export function noteHistoryTransition(state: NoteHistoryState, action: NoteHistoryAction): NoteHistoryState {
  switch (action.type) {
    case "apply":
      return sameNotes(state.present.notes, action.snapshot.notes) ? state : {
        past: [...state.past, state.present].slice(-80), present: action.snapshot, future: [],
      };
    case "select": {
      const selected = validSelection(action.indices, state.present.notes.length);
      if (selected.length === state.present.selected.length &&
          selected.every((index, position) => index === state.present.selected[position])) return state;
      return { ...state, present: { ...state.present, selected } };
    }
    case "undo":
      return !state.past.length ? state : {
        past: state.past.slice(0, -1), present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    case "redo":
      return !state.future.length ? state : {
        past: [...state.past, state.present].slice(-80), present: state.future[0],
        future: state.future.slice(1),
      };
    case "reset":
      return { past: [], present: action.snapshot, future: [] };
  }
}

export type NoteEditorView = {
  tool: "draw" | "select" | "erase" | "pan";
  snapDenominator: 4 | 8 | 16;
  visibleBars: 1 | 2 | 4;
  expandedDrums: boolean;
  viewStartTick: number;
};
export type NoteEditorOptions = {
  contextKey: string;
  notes: MidiNoteDto[];
  ppq: number;
  signature: TimeSignature;
  instrument: string | null;
  bounds: Pick<NoteEditBounds, "maxTick" | "minPitch" | "maxPitch">;
  editable: boolean;
  onCommit: (notes: MidiNoteDto[]) => boolean;
};
export type NoteEditorChange = {
  revision: number;
  type: "edit" | "undo" | "redo" | "reset";
  commandType: NoteEditCommand["type"] | null;
  /** Old array index to the surviving new index; undo/redo/reset deliberately invalidate every target. */
  indexMap: Array<number | null>;
};
export type NoteEditorController = {
  readonly snapshot: NoteEditorSnapshot;
  readonly displayNotes: MidiNoteDto[];
  readonly selection: readonly number[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasClipboard: boolean;
  readonly gestureActive: boolean;
  readonly error: string | null;
  readonly bounds: NoteEditBounds;
  readonly editable: boolean;
  readonly view: NoteEditorView;
  readonly windowTicks: number;
  readonly lastChange: NoteEditorChange | null;
  select: (indices: readonly number[], mode?: "replace" | "toggle" | "add") => void;
  selectAll: () => void;
  clearSelection: () => void;
  execute: (command: NoteEditCommand) => boolean;
  copy: () => boolean;
  paste: (atTick: number) => boolean;
  duplicate: () => boolean;
  undo: () => boolean;
  redo: () => boolean;
  beginGesture: () => void;
  previewGesture: (command: NoteEditCommand) => void;
  commitGesture: () => boolean;
  cancelGesture: () => void;
  setTool: (tool: NoteEditorView["tool"]) => void;
  setSnapDenominator: (value: NoteEditorView["snapDenominator"]) => void;
  setVisibleBars: (value: NoteEditorView["visibleBars"]) => void;
  setExpandedDrums: (value: boolean) => void;
  setViewStartTick: (value: number) => void;
};

type Gesture = { base: NoteEditorSnapshot; result: NoteEditResult | null; command: NoteEditCommand | null };
export type NoteEditorState = {
  history: NoteHistoryState;
  view: NoteEditorView;
  bounds: NoteEditBounds;
  windowTicks: number;
  editable: boolean;
  clipboard: MidiNoteDto[];
  gesture: Gesture | null;
  error: string | null;
  lastChange: NoteEditorChange | null;
};
const initialView = (): NoteEditorView => ({
  tool: "draw", snapDenominator: 8, visibleBars: 2, expandedDrums: false, viewStartTick: 0,
});

export function noteEditorGeometry(options: Omit<NoteEditorOptions, "onCommit">, view: NoteEditorView) {
  const instrument = findInstrument(options.instrument);
  const minPitch = Math.max(0, options.bounds.minPitch, instrument?.kind === "drum" ? instrument.minPitch ?? 35 : 0);
  const maxPitch = Math.min(127, options.bounds.maxPitch, instrument?.kind === "drum" ? instrument.maxPitch ?? 81 : 127);
  const ppq = Number.isFinite(options.ppq) && options.ppq > 0 ? options.ppq : 480;
  const signature = validSignature(options.signature) ? options.signature : defaultSignature;
  const windowTicks = ppq * 4 * signature.numerator / signature.denominator * view.visibleBars;
  const rows = (instrument?.kind === "drum" ? drumPitches(view.expandedDrums)
    : Array.from({ length: 128 }, (_, row) => 127 - row))
    .filter((pitch) => pitch >= minPitch && pitch <= maxPitch);
  const bounds: NoteEditBounds = {
    maxTick: options.bounds.maxTick, minPitch, maxPitch,
    stepTick: Math.max(1, Math.round(ppq * 4 / view.snapDenominator)), rows,
  };
  return { bounds, windowTicks,
    viewStartTick: clamp(view.viewStartTick, 0, Math.max(0, bounds.maxTick - windowTicks)) };
}

/** React-independent controller state. Draft writes occur only after a valid accepted command. */
export class NoteEditorSession {
  private options: NoteEditorOptions;
  private state: NoteEditorState;
  private listeners = new Set<() => void>();

  constructor(options: NoteEditorOptions) {
    this.options = options;
    const view = initialView();
    const geometry = noteEditorGeometry(options, view);
    this.state = {
      history: { past: [], present: { notes: structuredClone(options.notes), selected: [] }, future: [] },
      view, bounds: geometry.bounds, windowTicks: geometry.windowTicks, editable: options.editable,
      clipboard: [], gesture: null, error: null, lastChange: null,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(next: NoteEditorState) {
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  private fail(error: string) {
    this.publish({ ...this.state, error });
    return false;
  }
  private change(type: NoteEditorChange["type"], indexMap: Array<number | null>,
    commandType: NoteEditCommand["type"] | null = null): NoteEditorChange {
    return { revision: (this.state.lastChange?.revision ?? 0) + 1, type, indexMap, commandType };
  }
  configure(options: NoteEditorOptions) {
    const contextChanged = options.contextKey !== this.options.contextKey;
    this.options = options;
    let next = this.state;
    if (contextChanged || !sameNotes(options.notes, next.history.present.notes)) {
      const snapshot = { notes: structuredClone(options.notes), selected: [] };
      next = { ...next, history: noteHistoryTransition(next.history, { type: "reset", snapshot }),
        clipboard: [], gesture: null, error: null,
        view: contextChanged ? initialView() : next.view,
        lastChange: this.change("reset", next.history.present.notes.map(() => null)),
      };
    }
    const geometry = noteEditorGeometry(options, next.view);
    const boundsChanged = JSON.stringify(next.bounds) !== JSON.stringify(geometry.bounds);
    if (boundsChanged || next.windowTicks !== geometry.windowTicks || next.editable !== options.editable ||
        next.view.viewStartTick !== geometry.viewStartTick) {
      next = { ...next, bounds: geometry.bounds, windowTicks: geometry.windowTicks,
        editable: options.editable, view: { ...next.view, viewStartTick: geometry.viewStartTick },
        // Geometry and permissions may invalidate pointer coordinates; never commit their stale preview.
        gesture: null,
      };
    }
    this.publish(next);
  }
  select = (indices: readonly number[], mode: "replace" | "toggle" | "add" = "replace") => {
    if (this.state.gesture) this.cancelGesture();
    const picked = validSelection(indices, this.state.history.present.notes.length);
    const current = this.state.history.present.selected;
    const selected = mode === "replace" ? picked : mode === "add" ? [...new Set([...current, ...picked])]
      : [...current.filter((index) => !picked.includes(index)), ...picked.filter((index) => !current.includes(index))];
    const history = noteHistoryTransition(this.state.history, { type: "select", indices: selected });
    if (history !== this.state.history) this.publish({ ...this.state, history });
  };
  selectAll = () => this.select(this.state.history.present.notes.map((_, index) => index));
  clearSelection = () => this.select([]);
  private allowed() {
    if (!this.options.editable) return this.fail("읽기 전용이거나 현재 노트를 변경할 수 없습니다.");
    if (!findInstrument(this.options.instrument)) return this.fail("지원하는 MIDI 악기를 선택해주세요.");
    return true;
  }
  private accept(result: NoteEditResult, command: NoteEditCommand): boolean {
    if (!this.allowed()) return false;
    if (!result.changed || result.error) return this.fail(result.error ?? "변경할 내용이 없습니다.");
    const invalid = validateNotes(result.snapshot.notes, this.state.bounds);
    if (invalid) return this.fail(invalid);
    try {
      if (!this.options.onCommit(result.snapshot.notes)) return this.fail("노트 변경을 저장할 수 없습니다.");
    } catch (cause) {
      return this.fail(cause instanceof Error ? cause.message : "노트 변경을 저장할 수 없습니다.");
    }
    this.publish({ ...this.state,
      history: noteHistoryTransition(this.state.history, { type: "apply", snapshot: result.snapshot }),
      gesture: null, error: null, lastChange: this.change("edit", result.indexMap, command.type),
    });
    return true;
  }
  execute = (command: NoteEditCommand): boolean => {
    this.cancelGesture();
    if (!this.allowed()) return false;
    return this.accept(applyNoteEdit(this.state.history.present, command, this.state.bounds), command);
  };
  copy = (): boolean => {
    const clipboard = copyNotes(this.state.history.present.notes, new Set(this.state.history.present.selected));
    if (!clipboard.length) return this.fail("복사할 노트를 선택해주세요.");
    this.publish({ ...this.state, clipboard, error: null });
    return true;
  };
  paste = (atTick: number) => this.execute({ type: "paste", notes: this.state.clipboard, atTick });
  duplicate = () => this.execute({ type: "duplicate", indices: this.state.history.present.selected });
  private travel(type: "undo" | "redo"): boolean {
    this.cancelGesture();
    if (!this.allowed()) return false;
    const history = noteHistoryTransition(this.state.history, { type });
    if (history === this.state.history) return this.fail(type === "undo" ? "되돌릴 변경이 없습니다." : "다시 실행할 변경이 없습니다.");
    const invalid = validateNotes(history.present.notes, this.state.bounds);
    if (invalid) return this.fail(invalid);
    try {
      if (!this.options.onCommit(history.present.notes)) return this.fail("노트 변경을 저장할 수 없습니다.");
    } catch (cause) {
      return this.fail(cause instanceof Error ? cause.message : "노트 변경을 저장할 수 없습니다.");
    }
    this.publish({ ...this.state, history, gesture: null, error: null,
      lastChange: this.change(type, this.state.history.present.notes.map(() => null)),
    });
    return true;
  }
  undo = () => this.travel("undo");
  redo = () => this.travel("redo");
  beginGesture = () => {
    if (!this.allowed()) return;
    this.publish({ ...this.state, gesture: { base: this.state.history.present, result: null, command: null }, error: null });
  };
  previewGesture = (command: NoteEditCommand) => {
    if (!this.state.gesture || !this.options.editable) return;
    const result = applyNoteEdit(this.state.gesture.base, command, this.state.bounds);
    this.publish({ ...this.state, gesture: { ...this.state.gesture, result, command }, error: result.error });
  };
  commitGesture = (): boolean => {
    const gesture = this.state.gesture;
    if (!gesture) return false;
    this.publish({ ...this.state, gesture: null });
    // The last candidate is authoritative: an invalid final preview must not commit an earlier one.
    if (!gesture.result || !gesture.command) return false;
    return this.accept(gesture.result, gesture.command);
  };
  cancelGesture = () => {
    if (this.state.gesture) this.publish({ ...this.state, gesture: null, error: null });
  };
  private setView(changes: Partial<NoteEditorView>) {
    const view = { ...this.state.view, ...changes };
    const geometry = noteEditorGeometry(this.options, view);
    view.viewStartTick = geometry.viewStartTick;
    if (JSON.stringify(view) === JSON.stringify(this.state.view)) return;
    this.publish({ ...this.state, view, bounds: geometry.bounds, windowTicks: geometry.windowTicks,
      gesture: Object.keys(changes).every((key) => key === "viewStartTick") ? this.state.gesture : null,
    });
  }
  setTool = (tool: NoteEditorView["tool"]) => this.setView({ tool });
  setSnapDenominator = (snapDenominator: NoteEditorView["snapDenominator"]) => this.setView({ snapDenominator });
  setVisibleBars = (visibleBars: NoteEditorView["visibleBars"]) => this.setView({ visibleBars });
  setExpandedDrums = (expandedDrums: boolean) => this.setView({ expandedDrums });
  setViewStartTick = (viewStartTick: number) => {
    if (Number.isFinite(viewStartTick)) this.setView({ viewStartTick });
  };
}

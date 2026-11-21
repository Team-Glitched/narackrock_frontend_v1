import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { NoteEditorSession, type NoteEditorController, type NoteEditorOptions } from "./note-editor.ts";
export type {
  NoteEditorController, NoteEditorOptions, NoteEditorView, NoteEditorChange,
  NoteEditorSnapshot, NoteEditBounds, NoteEditCommand, NoteEditResult,
} from "./note-editor.ts";

/** One editor per mounted draft/source; autosave acknowledgements do not replace its history. */
export function useNoteEditor(options: NoteEditorOptions): NoteEditorController {
  const latest = useRef(options);
  // Commits are wired to the latest caller in the layout effect below, before any user input can occur.
  const [session] = useState(() => new NoteEditorSession({ ...options, onCommit: () => false }));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useLayoutEffect(() => {
    session.configure({ ...latest.current, onCommit: (notes) => latest.current.onCommit(notes) });
  }, [session, options.contextKey, options.notes, options.ppq,
    options.signature.numerator, options.signature.denominator, options.instrument,
    options.bounds.maxTick, options.bounds.minPitch, options.bounds.maxPitch, options.editable]);
  useEffect(() => () => session.cancelGesture(), [session]);
  const preview = state.gesture?.result?.snapshot;
  return {
    snapshot: state.history.present,
    displayNotes: preview?.notes ?? state.history.present.notes,
    selection: preview?.selected ?? state.history.present.selected,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    hasClipboard: state.clipboard.length > 0,
    gestureActive: state.gesture !== null,
    error: state.error,
    bounds: state.bounds,
    editable: state.editable,
    view: state.view,
    windowTicks: state.windowTicks,
    lastChange: state.lastChange,
    select: session.select,
    selectAll: session.selectAll,
    clearSelection: session.clearSelection,
    execute: session.execute,
    copy: session.copy,
    paste: session.paste,
    duplicate: session.duplicate,
    undo: session.undo,
    redo: session.redo,
    beginGesture: session.beginGesture,
    previewGesture: session.previewGesture,
    commitGesture: session.commitGesture,
    cancelGesture: session.cancelGesture,
    setTool: session.setTool,
    setSnapDenominator: session.setSnapDenominator,
    setVisibleBars: session.setVisibleBars,
    setExpandedDrums: session.setExpandedDrums,
    setViewStartTick: session.setViewStartTick,
    setZoom: session.setZoom,
  };
}

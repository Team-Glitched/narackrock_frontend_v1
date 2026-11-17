import { useState } from "react";
import type { NativeNoteRoll, NativeNoteRollAction } from "@/lib/native-screens/editor";
import { chordLengths, chordQualities } from "./chord-input";
import { placeChord } from "./chord-picker-dialog";
import type { ClipLocalTiming } from "./clip-local-timing";
import { findInstrument } from "./instrument-catalog";
import { partLabel } from "./instrument-parts";
import type { TimeSignature } from "./time-signature";
import type { NoteEditorController } from "./use-note-editor";

export type NoteEditorDialogs = {
  /** Index of the note whose settings are open. */
  settingsIndex: number | null;
  setSettingsIndex: (index: number | null) => void;
  showChords: boolean;
  setShowChords: (open: boolean) => void;
};

/**
 * The note settings and chord dialogs of a note editor. Settings follow their note through accepted edits and
 * close on delete/undo/redo/reset; both close when the editor becomes read-only (`onLocked` closes the
 * caller's other dialogs at the same moment).
 */
export function useNoteEditorDialogs(editor: NoteEditorController, onLocked?: () => void): NoteEditorDialogs {
  const [settingsIndex, setSettingsIndex] = useState<number | null>(null);
  const [showChords, setShowChords] = useState(false);
  const [seenChange, setSeenChange] = useState(editor.lastChange);
  if (seenChange !== editor.lastChange) {
    setSeenChange(editor.lastChange);
    const change = editor.lastChange;
    if (change)
      setSettingsIndex((index) => index === null ? null :
        change.type !== "edit" || change.commandType === "delete"
          ? null : change.indexMap[index] ?? null);
  }
  const [wasEditable, setWasEditable] = useState(editor.editable);
  if (wasEditable !== editor.editable) {
    setWasEditable(editor.editable);
    if (!editor.editable) {
      setSettingsIndex(null);
      setShowChords(false);
      onLocked?.();
    }
  }
  return { settingsIndex, setSettingsIndex, showChords, setShowChords };
}

/**
 * The app's piano roll over a web `useNoteEditor` controller: the model the native `NoteRoll`,
 * `NoteControls`, `NoteTools` and `NoteRollSheets` draw, and `act` performing their actions with the web
 * editor's own rules (validation, history, draft writes). Gestures run in the app; it sends final edits.
 */
export function useNativeNoteRoll({
  editor, dialogs, engine, ppq, signature, timing, positionTick, playing, instrument, initialPitch,
  onAudition, onSeekTick, onOpenChords, settings = true,
}: {
  editor: NoteEditorController;
  dialogs: NoteEditorDialogs;
  engine: string | null;
  ppq: number;
  signature: TimeSignature;
  timing: ClipLocalTiming;
  positionTick: number;
  playing: boolean;
  instrument: string | null;
  initialPitch: number;
  onAudition: (pitch: number) => void;
  /** Clip-local tick. */
  onSeekTick: (tick: number) => void;
  /** Opens the chord dialog (e.g. pauses, then `dialogs.setShowChords(true)`); omit to hide "코드". */
  onOpenChords?: () => void;
  /** Offers "노트 설정". */
  settings?: boolean;
}): { model: NativeNoteRoll; act: (action: NativeNoteRollAction) => void } {
  const [chordError, setChordError] = useState<string | null>(null);
  const { bounds, view } = editor;
  const notes = editor.snapshot.notes;
  const revision = editor.lastChange?.revision ?? 0;
  const drum = findInstrument(instrument)?.kind === "drum";
  const settingsNote = dialogs.settingsIndex === null || !editor.editable
    ? undefined : notes[dialogs.settingsIndex];
  const model: NativeNoteRoll = {
    engine,
    notes,
    selection: [...editor.selection],
    revision,
    editable: editor.editable,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    hasClipboard: editor.hasClipboard,
    error: editor.error,
    tool: view.tool,
    snapDenominator: view.snapDenominator,
    visibleBars: view.visibleBars,
    expandedDrums: view.expandedDrums,
    viewStartTick: view.viewStartTick,
    windowTicks: editor.windowTicks,
    maxTick: bounds.maxTick,
    minPitch: bounds.minPitch,
    maxPitch: bounds.maxPitch,
    stepTick: bounds.stepTick,
    rows: [...bounds.rows],
    drum,
    hidden: drum ? notes.filter((note) => !bounds.rows.includes(note.pitch)).length : 0,
    ppq,
    numerator: signature.numerator,
    denominator: signature.denominator,
    tickMs: timing.tickMs,
    clipStartMs: timing.clipStartMs,
    positionTick,
    playing,
    initialPitch,
    canSettings: settings,
    canChord: Boolean(onOpenChords) && !drum,
    settings: settingsNote && dialogs.settingsIndex !== null ? {
      index: dialogs.settingsIndex,
      note: settingsNote,
      part: partLabel(instrument),
      stepTick: bounds.stepTick,
      maxTick: bounds.maxTick,
      key: `${dialogs.settingsIndex}:${revision}`,
    } : null,
    chords: dialogs.showChords && editor.editable ? { error: chordError ?? editor.error } : null,
  };

  function act(action: NativeNoteRollAction) {
    switch (action.type) {
      case "roll-edit":
        // An edit drawn over notes that changed since is dropped; the app redraws from the new model.
        if (action.revision === revision && editor.execute(action.edit) && action.audition !== undefined)
          onAudition(action.audition);
        return;
      case "roll-select":
        return editor.select(action.indices, action.mode);
      case "roll-select-all":
        return editor.selectAll();
      case "roll-clear-selection":
        return editor.clearSelection();
      case "roll-copy":
        return void editor.copy();
      case "roll-paste":
        return void editor.paste(positionTick);
      case "roll-duplicate":
        return void editor.duplicate();
      case "roll-delete":
        return void editor.execute({ type: "delete", indices: editor.selection });
      case "roll-undo":
        return void editor.undo();
      case "roll-redo":
        return void editor.redo();
      case "roll-tool":
        return editor.setTool(action.tool);
      case "roll-snap":
        return editor.setSnapDenominator(action.value);
      case "roll-bars":
        return editor.setVisibleBars(action.value);
      case "roll-drums":
        return editor.setExpandedDrums(action.expanded);
      case "roll-view":
        return editor.setViewStartTick(action.tick);
      case "roll-audition":
        return onAudition(action.pitch);
      case "roll-seek":
        return onSeekTick(Math.max(0, Math.min(bounds.maxTick, action.tick)));
      case "roll-settings-open":
        if (settings && editor.editable && editor.selection.length === 1)
          dialogs.setSettingsIndex(editor.selection[0]);
        return;
      case "roll-settings-apply":
        if (editor.execute({ type: "replace", index: action.index, note: action.note }))
          dialogs.setSettingsIndex(null);
        return;
      case "roll-settings-close":
        return dialogs.setSettingsIndex(null);
      case "roll-chords-open":
        if (!onOpenChords || drum || !editor.editable) return;
        setChordError(null);
        return onOpenChords();
      case "roll-chord": {
        const quality = chordQualities.find((item) => item.id === action.quality)?.id;
        const length = chordLengths.find((item) => item.value === action.length)?.value;
        if (!dialogs.showChords || !quality || !length) return;
        const failure = placeChord(editor, {
          ppq, signature, positionTick, octave: action.octave, root: action.root, length, quality,
        });
        setChordError(failure);
        if (!failure) dialogs.setShowChords(false);
        return;
      }
      case "roll-chords-close":
        setChordError(null);
        return dialogs.setShowChords(false);
    }
  }
  return { model, act };
}

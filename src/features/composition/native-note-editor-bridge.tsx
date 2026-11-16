import { useState } from "react";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeNoteEditor, NativeNoteEditorAction } from "@/lib/native-screens/editor";
import { isNativeNoteRollAction } from "@/lib/native-screens/editor";
import {
  isNativeInstrumentAction,
  isNativeSourcePickerAction,
  isNativeTimingAction,
  isNativeTransportAction,
} from "@/lib/native-screens/studio";
import { partLabel } from "./instrument-parts";
import { useNativeInstrumentPicker } from "./instrument-dialog";
import { useNativeSourcePicker } from "./studio-source-dialog";
import { nativeTransport, transportAction } from "./studio-toolbar";
import { useNativeTiming } from "./timing-dialog";
import { useNativeNoteRoll } from "./use-note-editor-native";
import type { NoteEditorScreenState } from "./use-note-editor-screen";

/** The app's note editor while the project loads or cannot open ("돌아가기" is the header back). */
export function NativeNoteEditorStateBridge({ status, message, onBack }: {
  status: "loading" | "error";
  message: string;
  onBack: () => void;
}) {
  return useNativeScreen("editor-notes", { status, message }, { header: null, onBack });
}

/** The app's native note editor over the web screen's own state (`useNoteEditorScreen`). */
export function NativeNoteEditorBridge({ screen, portrait, onToggleLayout, onBack }: {
  screen: NoteEditorScreenState;
  portrait: boolean;
  onToggleLayout?: () => void;
  onBack: () => void;
}) {
  const { composition, track, editor, playback, draft, dialogs, busy, editable } = screen;
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  // Like the web dialogs, the picker closes when the layer stops being editable.
  if (instrumentOpen && !screen.instrumentChoice) setInstrumentOpen(false);
  const roll = useNativeNoteRoll({
    editor,
    dialogs,
    engine: playback.nativeEngine,
    ppq: composition.project.ppq,
    signature: playback.signature,
    timing: screen.timing,
    positionTick: screen.positionTick,
    playing: playback.playing,
    instrument: track.instrument,
    initialPitch: screen.notes[0]?.pitch ?? 60,
    onAudition: screen.audition,
    onSeekTick: screen.seekTick,
    onOpenChords: screen.openChords,
  });
  const instrument = useNativeInstrumentPicker(
    instrumentOpen && screen.instrumentChoice ? screen.instrumentChoice : null,
    () => setInstrumentOpen(false),
  );
  const timing = useNativeTiming(
    { bpm: composition.project.bpm, signature: playback.signature },
    screen.onTiming,
  );
  const sources = useNativeSourcePicker({
    open: screen.showSources && editor.editable,
    onOpen: () => screen.openSources?.(),
    onClose: () => screen.setShowSources(false),
    onResource: screen.importResource,
    onOpenSource: screen.insertOpenSource,
  });
  const model: NativeNoteEditor = screen.clipUnavailable
    ? { status: "error", message: "선택한 MIDI 클립을 찾을 수 없습니다." }
    : {
        status: "ready",
        portrait,
        layoutToggle: Boolean(onToggleLayout),
        title: `${track.name} · 피아노롤`,
        transport: nativeTransport(playback, composition.project.bpm),
        roll: roll.model,
        timingEditable: Boolean(screen.onTiming),
        timing: timing.model,
        instrument: screen.instrumentChoice ? { label: partLabel(track.instrument) } : null,
        instrumentPicker: instrument.model,
        canImportSource: Boolean(screen.openSources),
        sources: sources.model,
        editable,
        statusText: screen.statusText,
        error: screen.shownError,
        retryLoad: Boolean(draft.loadError && !draft.session),
        conflict: draft.state?.status === "conflict",
        busy,
        exit: screen.exitTarget && {
          busy,
          saveDisabled: busy || !draft.session || draft.state?.status === "conflict",
          keepDisabled: busy || Boolean(draft.state?.hasUnsavedChanges && !draft.state.localProtected),
        },
      };
  function onAction(action: NativeNoteEditorAction) {
    if (isNativeNoteRollAction(action)) return roll.act(action);
    if (isNativeInstrumentAction(action)) return instrument.act(action);
    if (isNativeTimingAction(action)) return timing.act(action);
    if (isNativeSourcePickerAction(action)) return sources.act(action);
    if (isNativeTransportAction(action))
      // The editor's play first returns to the clip start (or the song start after its end).
      return action.type === "transport-play" ? screen.play() : transportAction(playback, action);
    switch (action.type) {
      case "editor-rewind":
        return screen.rewind();
      case "editor-layers":
        return screen.openLayerList();
      case "editor-instrument-open":
        if (screen.instrumentChoice) setInstrumentOpen(true);
        return;
      case "editor-layout":
        return onToggleLayout?.();
      case "editor-retry-load":
        return draft.retryLoad();
      case "editor-use-server":
        return screen.useServer();
      case "editor-keep-local":
        return screen.keepLocal();
      case "editor-export":
        return screen.exportRecovery();
      case "editor-exit-save":
        return screen.saveAndExit();
      case "editor-exit-keep":
        return screen.keepAndExit();
      case "editor-exit-discard":
        return screen.discardAndExit();
      case "editor-exit-cancel":
        return screen.closeExit();
    }
  }
  return useNativeScreen("editor-notes", model, {
    header: null,
    onAction: (action) => {
      if (action.type !== "more") onAction(action);
    },
    onBack: screen.clipUnavailable ? onBack : screen.requestBack,
  });
}

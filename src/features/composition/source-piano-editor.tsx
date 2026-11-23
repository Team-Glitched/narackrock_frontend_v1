import { useDevicePortrait } from "@/hooks/use-device-portrait";
import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { StudioToolbar } from "@/features/composition/studio-toolbar";
import { NoteSettingsDialog } from "@/features/composition/note-settings-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import { useCompositionPlayback, type PlaybackComposition } from "./use-composition-playback";
import { renderPianoAudio } from "./source-piano-render";
import { defaultSignature } from "./time-signature";
import { useNoteEditor } from "./use-note-editor";
import { NoteEditorControls, NoteTools } from "./note-editor-controls";
import { PortraitNoteEditor } from "./note-editor-portrait";
import { importJsonNoteFile } from "./json-note-import";
import { ChordPickerDialog } from "./chord-picker-dialog";
import { useNoteEditorShortcuts } from "./use-note-editor-shortcuts";
import { clipLocalTiming, clipPositionTick, projectPositionMs } from "./clip-local-timing";
import { useNativeNoteRoll, useNoteEditorDialogs } from "./use-note-editor-native";
import type { ProjectTiming } from "./project-timing";
import { nativeTransport, transportAction } from "./studio-toolbar";
import { useNativeTiming } from "./timing-dialog";
import { useNativeInstrumentPicker, type InstrumentChoice } from "./instrument-dialog";
import { resolveSampleInstrument } from "./piano-render-plan";
import type { NativeCreationPiano, NativeCreationPianoAction } from "@/lib/native-screens";
import { isNativeNoteRollAction } from "@/lib/native-screens/editor";
import {
  isNativeInstrumentAction,
  isNativeTimingAction,
  isNativeTransportAction,
} from "@/lib/native-screens/studio";

export type SourcePianoProps = {
  notes: MidiNoteDto[];
  setNotes: Dispatch<SetStateAction<MidiNoteDto[]>>;
  bpm: number;
  onBpm: (bpm: number) => void;
  onBack: () => void;
  onSave: (file: File) => void;
};

/**
 * The sample registration piano sketch: playback, note editor, its dialogs, timing and rendering the
 * notes to the audio attachment. Shared by the web editor and the app's native screen.
 */
export function useSourcePiano({ notes, setNotes, bpm, onBpm, onSave }: SourcePianoProps) {
  const maxTick = bpm * 480; // One minute, matching upload/record limits.
  // A source sketch is not a project; its time signature is only for this editor's grid.
  const [signature, setSignature] = useState(defaultSignature);
  const [instrumentId, setInstrumentId] = useState("piano");
  const instrument = resolveSampleInstrument(instrumentId);
  const sourceScopeId = useId();
  const composition = useMemo<PlaybackComposition>(
    () => ({
      project: {
        timeSignatureNumerator: signature.numerator,
        timeSignatureDenominator: signature.denominator,
        bpm,
        ppq: 480,
        maxDurationMs: 60000,
      },
      tracks: [
        {
          trackId: 0,
          ownerId: 0,
          name: instrument.label,
          instrument: instrument.id,
          volume: 100,
          pan: 0,
          isMuted: false,
          isSolo: false,
          approvalStatus: "DRAFT",
          clips: [
            {
              clipId: 0,
              ownerId: 0,
              clipType: "MIDI",
              sourceType: "MIDI_INPUT",
              mediaFileId: null,
              mediaUrl: null,
              startTick: 0,
              durationTick: maxTick,
              startTimeMs: 0,
              durationMs: 60000,
              clipOffsetMs: 0,
              approvalStatus: "DRAFT",
              midiNotes: notes,
            },
          ],
        },
      ],
    }),
    [notes, bpm, maxTick, signature, instrument.id, instrument.label],
  );
  const player = useCompositionPlayback(composition, {
    scopeKey: JSON.stringify(["source", sourceScopeId]),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timing = clipLocalTiming(bpm, 480, maxTick, 0);
  const positionTick = clipPositionTick(player.positionMs, timing);
  const editor = useNoteEditor({
    contextKey: JSON.stringify(["source", sourceScopeId]),
    notes,
    ppq: 480,
    signature,
    instrument: instrument.id,
    bounds: { maxTick, minPitch: 0, maxPitch: 127 },
    editable: !pending,
    onCommit: (next) => {
      if (pending) return false;
      setNotes(next);
      return true;
    },
  });
  const instrumentChoice = useMemo<InstrumentChoice>(
    () => ({
      value: instrument.id,
      mode: "midi",
      tracks: [],
      onPreview: (id) => player.previewInstrument(id),
      onStopPreview: player.stopPreview,
      onConfirm: async (id) => {
        player.pause();
        player.stopPreview();
        setInstrumentId(id);
      },
    }),
    [instrument.id, player],
  );
  // Settings follow their note through accepted edits; both dialogs close while rendering.
  const dialogs = useNoteEditorDialogs(editor);
  function play() {
    void player.play().catch(() => setError("재생하지 못했습니다."));
  }
  async function applyTiming(timing: ProjectTiming) {
    if (notes.some((note) => note.startTick + note.durationTick > timing.bpm * 480))
      throw new Error("현재 노트가 1분을 초과하는 BPM입니다.");
    player.pause();
    onBpm(timing.bpm);
    setSignature(timing.signature);
    setError(null);
  }
  async function save() {
    if (pending) return;
    if (!notes.length) {
      setError("피아노롤에 노트를 추가해주세요.");
      return;
    }
    player.pause();
    setPending(true);
    setError(null);
    try {
      onSave(await renderPianoAudio(notes, bpm, instrument.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "오디오를 만들지 못했습니다.");
    } finally {
      setPending(false);
    }
  }
  return {
    maxTick,
    signature,
    instrument,
    instrumentId: instrument.id,
    instrumentChoice,
    player,
    pending,
    error,
    timing,
    positionTick,
    editor,
    dialogs,
    play,
    applyTiming,
    clearError: () => setError(null),
    rewind: () => player.seek(projectPositionMs(0, timing)),
    seekTick: (tick: number) => player.seek(projectPositionMs(tick, timing)),
    save,
  };
}

/**
 * The app's sample piano (kind "creation-piano"): the same `useSourcePiano` state, drawn natively with
 * the note editor's roll, the studio toolbar and its timing sheet.
 */
export function useNativeSourcePiano(props: SourcePianoProps): {
  model: NativeCreationPiano;
  act: (action: NativeCreationPianoAction) => void;
} {
  const piano = useSourcePiano(props);
  const { player, editor, dialogs, pending } = piano;
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const picker = useNativeInstrumentPicker(
    instrumentOpen && !pending ? piano.instrumentChoice : null,
    () => setInstrumentOpen(false),
  );
  const timing = useNativeTiming(
    { bpm: props.bpm, signature: piano.signature },
    pending ? undefined : piano.applyTiming,
  );
  const roll = useNativeNoteRoll({
    editor,
    dialogs,
    engine: player.nativeEngine,
    ppq: 480,
    signature: piano.signature,
    timing: piano.timing,
    positionTick: piano.positionTick,
    playing: player.playing,
    instrument: piano.instrumentId,
    initialPitch: piano.instrument.kind === "drum" ? 36 : 60,
    onAudition: (pitch) => void player.audition(pitch, piano.instrumentId),
    onSeekTick: piano.seekTick,
    onOpenChords: () => {
      player.pause();
      dialogs.setShowChords(true);
    },
  });
  return {
    model: {
      title: "샘플 피아노롤",
      addLabel: "오디오 선택 완료",
      pending,
      error: piano.error ?? player.error ?? editor.error,
      transport: nativeTransport(player, props.bpm),
      timing: timing.model,
      roll: roll.model,
      instrumentLabel: piano.instrument.label,
      instrumentPicker: picker.model,
    },
    act(action) {
      if (isNativeInstrumentAction(action)) return picker.act(action);
      if (isNativeNoteRollAction(action)) return roll.act(action);
      if (isNativeTimingAction(action)) return timing.act(action);
      // Play reports its failure like the web toolbar's play button.
      if (action.type === "transport-play") return piano.play();
      if (isNativeTransportAction(action)) return transportAction(player, action);
      switch (action.type) {
        case "creation-piano-back":
          if (!pending) props.onBack();
          return;
        case "creation-piano-rewind":
          return piano.rewind();
        case "creation-piano-save":
          return void piano.save();
        case "creation-piano-instrument-open":
          if (!pending) {
            player.pause();
            setInstrumentOpen(true);
          }
          return;
      }
    },
  };
}

export function SourcePianoEditor(props: SourcePianoProps) {
  const { bpm, onBack } = props;
  const portrait = useDevicePortrait();
  const piano = useSourcePiano(props);
  const { maxTick, signature, player, pending, error, positionTick, editor, dialogs, play } = piano;
  const jsonInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const busy = pending || importing;
  async function importJson(file: File) {
    if (busy) return;
    player.pause();
    piano.clearError();
    setImportError(null);
    setImporting(true);
    try {
      await importJsonNoteFile(editor, file, 480);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "JSON 파일을 읽지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }
  const { setVisibleBars } = editor;
  useEffect(() => setVisibleBars(portrait ? 1 : 2), [portrait, setVisibleBars]);
  const {
    settingsIndex: settings,
    setSettingsIndex: setSettings,
    showChords,
    setShowChords,
  } = dialogs;
  useNoteEditorShortcuts({
    editor,
    positionTick,
    playing: player.playing,
    onPlay: play,
    onPause: player.pause,
  });
  const drum = piano.instrument.kind === "drum";
  const hiddenDrumNotes = drum
    ? editor.snapshot.notes.filter((note) => !editor.bounds.rows.includes(note.pitch)).length
    : 0;
  const controls = (
    <NoteEditorControls
      editor={editor}
      positionTick={positionTick}
      tools={!portrait}
      showModeAction={!portrait}
      onSettings={() => {
        if (editor.selection.length === 1) setSettings(editor.selection[0]);
      }}
      onChord={
        !drum
          ? () => {
              player.pause();
              setShowChords(true);
            }
          : undefined
      }
    />
  );
  const status = (
    <div className="note-editor-status flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-[#2b2b34] bg-[#19191f] px-3 py-1.5 text-caption text-app-muted">
      {importError || error || player.error || editor.error ? (
        <p className="m-0 min-w-0 flex-1" role="alert">
          {importError ?? error ?? player.error ?? editor.error}
        </p>
      ) : (
        <p className="m-0 min-w-0 flex-1" role="status">
          {importing
            ? "JSON 파일을 읽는 중..."
            : pending
              ? "오디오를 만드는 중..."
              : `${editor.snapshot.notes.length}개 노트`}
        </p>
      )}
      <button
        type="button"
        className="h-7 shrink-0 rounded-[8px] border border-[#32323d] bg-[#23232a] px-2.5 text-caption font-medium text-app-fg disabled:opacity-50"
        disabled={busy}
        onClick={() => jsonInput.current?.click()}
      >
        + JSON으로 추가
      </button>
    </div>
  );
  const roll = (
    <TeamPianoRoll
      editor={editor}
      signature={signature}
      ppq={480}
      maxTick={maxTick}
      positionTick={positionTick}
      onSeekTick={piano.seekTick}
      playing={player.playing}
      instrument={piano.instrumentId}
      onAudition={(pitch) => void player.audition(pitch, piano.instrumentId)}
      rowHeight={portrait ? 40 : undefined}
      keyWidth={portrait ? 44 : undefined}
      initialPitch={piano.instrument.kind === "drum" ? 36 : (props.notes[0]?.pitch ?? 60)}
      onSettings={editor.editable ? setSettings : undefined}
    />
  );
  const leave = () => {
    if (!busy) onBack();
  };
  return (
    <div
      className={cn(studioStyles.studio, portrait && studioStyles.studioPortrait, "note-editor")}
    >
      {portrait ? (
        <PortraitNoteEditor
          title="샘플 피아노롤"
          bpm={bpm}
          signature={signature}
          onTiming={busy ? undefined : piano.applyTiming}
          timeMs={player.positionMs}
          instrument={piano.instrumentChoice}
          playing={player.playing}
          onPlay={play}
          onPause={player.pause}
          onRewind={piano.rewind}
          metronome={player.metronome}
          onMetronome={() => player.setMetronome((value) => !value)}
          onBack={leave}
          onChord={
            editor.editable && !drum
              ? () => {
                  player.pause();
                  setShowChords(true);
                }
              : undefined
          }
          drumToggle={
            editor.editable && drum
              ? {
                  expanded: editor.view.expandedDrums,
                  hidden: hiddenDrumNotes,
                  onToggle: () => editor.setExpandedDrums(!editor.view.expandedDrums),
                }
              : undefined
          }
          action={{ label: "오디오 선택 완료", onClick: () => void piano.save(), disabled: busy }}
          controls={controls}
          status={status}
          tools={<NoteTools editor={editor} large />}
          roll={roll}
        />
      ) : (
        <>
          <StudioToolbar
            signature={signature}
            onTiming={busy ? undefined : piano.applyTiming}
            instrument={piano.instrumentChoice}
            piano
            title="샘플 피아노롤"
            bpm={bpm}
            playing={player.playing}
            positionMs={player.positionMs}
            onPlay={play}
            onPause={player.pause}
            onRewind={piano.rewind}
            onBack={leave}
            metronome={player.metronome}
            onMetronome={() => player.setMetronome((value) => !value)}
            addLabel="오디오 선택 완료"
            onAdd={busy ? undefined : () => void piano.save()}
          />
          {controls}
          {status}
          {roll}
        </>
      )}
      <input
        ref={jsonInput}
        type="file"
        accept=".json,application/json"
        aria-label="JSON 음표 파일"
        hidden
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importJson(file);
        }}
      />
      {showChords && editor.editable && (
        <ChordPickerDialog
          editor={editor}
          ppq={480}
          signature={signature}
          positionTick={positionTick}
          onClose={() => setShowChords(false)}
        />
      )}
      {settings !== null && editor.editable && editor.snapshot.notes[settings] && (
        <NoteSettingsDialog
          key={`${settings}:${editor.lastChange?.revision ?? 0}`}
          note={editor.snapshot.notes[settings]}
          stepTick={editor.bounds.stepTick}
          maxTick={maxTick}
          instrument={piano.instrumentId}
          onClose={() => setSettings(null)}
          onApply={(note) => editor.execute({ type: "replace", index: settings, note })}
        />
      )}
    </div>
  );
}

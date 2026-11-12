import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { StudioToolbar } from "@/features/composition/studio-toolbar";
import { NoteSettingsDialog } from "@/features/composition/note-settings-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import { useCompositionPlayback, type PlaybackComposition } from "./use-composition-playback";
import { renderPianoAudio } from "./source-piano-render";
import { defaultSignature } from "./time-signature";
import { useNoteEditor } from "./use-note-editor";
import { NoteEditorControls } from "./note-editor-controls";
import { ChordPickerDialog } from "./chord-picker-dialog";
import { useNoteEditorShortcuts } from "./use-note-editor-shortcuts";
import { clipLocalTiming, clipPositionTick, projectPositionMs } from "./clip-local-timing";

export function SourcePianoEditor({
  notes,
  setNotes,
  bpm,
  onBpm,
  onBack,
  onSave,
}: {
  notes: MidiNoteDto[];
  setNotes: Dispatch<SetStateAction<MidiNoteDto[]>>;
  bpm: number;
  onBpm: (bpm: number) => void;
  onBack: () => void;
  onSave: (file: File) => void;
}) {
  const maxTick = bpm * 480; // One minute, matching upload/record limits.
  // A source sketch is not a project; its time signature is only for this editor's grid.
  const [signature, setSignature] = useState(defaultSignature);
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
          name: "피아노",
          instrument: "piano",
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
    [notes, bpm, maxTick, signature],
  );
  const player = useCompositionPlayback(composition, {
    scopeKey: JSON.stringify(["source", sourceScopeId]),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<number | null>(null);
  const [showChords, setShowChords] = useState(false);
  const timing = clipLocalTiming(bpm, 480, maxTick, 0);
  const positionTick = clipPositionTick(player.positionMs, timing);
  const editor = useNoteEditor({
    contextKey: JSON.stringify(["source", sourceScopeId]),
    notes,
    ppq: 480,
    signature,
    instrument: "piano",
    bounds: { maxTick, minPitch: 0, maxPitch: 127 },
    editable: !pending,
    onCommit: (next) => {
      if (pending) return false;
      setNotes(next);
      return true;
    },
  });
  // Settings follow their note through accepted edits and close on delete/undo/redo/reset.
  const [seenChange, setSeenChange] = useState(editor.lastChange);
  if (seenChange !== editor.lastChange) {
    setSeenChange(editor.lastChange);
    const change = editor.lastChange;
    if (change)
      setSettings((index) => index === null ? null :
        change.type !== "edit" || change.commandType === "delete"
          ? null : change.indexMap[index] ?? null);
  }
  const [wasPending, setWasPending] = useState(pending);
  if (wasPending !== pending) {
    setWasPending(pending);
    if (pending) {
      setSettings(null);
      setShowChords(false);
    }
  }
  function play() {
    void player.play().catch(() => setError("재생하지 못했습니다."));
  }
  useNoteEditorShortcuts({
    editor, positionTick, playing: player.playing, onPlay: play, onPause: player.pause,
  });
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
      onSave(await renderPianoAudio(notes, bpm));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "오디오를 만들지 못했습니다.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={cn(studioStyles.studio, "note-editor")}>
      <StudioToolbar
        signature={player.signature}
        onTiming={pending ? undefined : async (timing) => {
          if (notes.some((note) => note.startTick + note.durationTick > timing.bpm * 480))
            throw new Error("현재 노트가 1분을 초과하는 BPM입니다.");
          player.pause();
          onBpm(timing.bpm);
          setSignature(timing.signature);
          setError(null);
        }}
        piano
        title="샘플 피아노롤"
        bpm={bpm}
        playing={player.playing}
        positionMs={player.positionMs}
        onPlay={play}
        onPause={player.pause}
        onRewind={() => player.seek(projectPositionMs(0, timing))}
        onBack={() => {
          if (!pending) onBack();
        }}
        volume={player.volume}
        onVolume={player.setVolume}
        metronome={player.metronome}
        onMetronome={() => player.setMetronome((value) => !value)}
        addLabel="오디오 선택 완료"
        onAdd={pending ? undefined : () => void save()}
      />
      <NoteEditorControls
        editor={editor}
        positionTick={positionTick}
        onSettings={() => {
          if (editor.selection.length === 1) setSettings(editor.selection[0]);
        }}
        onChord={() => {
          player.pause();
          setShowChords(true);
        }}
      />
      {(error || player.error || editor.error) && (
        <p className={studioStyles.studioError} role="alert">
          {error ?? player.error ?? editor.error}
        </p>
      )}
      {pending && (
        <p className={studioStyles.studioError} role="status">
          오디오를 만드는 중...
        </p>
      )}
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
          instrument="piano"
          onClose={() => setSettings(null)}
          onApply={(note) => editor.execute({ type: "replace", index: settings, note })}
        />
      )}
      <TeamPianoRoll
        editor={editor}
        signature={signature}
        ppq={480}
        maxTick={maxTick}
        positionTick={positionTick}
        onSeekTick={(tick) => player.seek(projectPositionMs(tick, timing))}
        playing={player.playing}
        instrument="piano"
        onAudition={(pitch) => void player.audition(pitch, "piano")}
        initialPitch={60}
        onSettings={editor.editable ? setSettings : undefined}
      />
    </div>
  );
}

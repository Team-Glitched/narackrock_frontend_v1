import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { NoteSettingsDialog } from "@/components/app/dialog";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { StudioSourceDialog } from "@/features/composition/studio-source-dialog";
import type { Resource } from "@/features/workspace/workspace-store";
import { TeamPianoRoll } from "@/features/composition/team-piano-roll";
import {
  createMidiClip,
  getComposition,
  saveMidiClip,
  type CompositionDto,
  type MidiNoteDto,
} from "@/lib/api/composition";
import { errorText } from "./studio-helpers";
import { StudioToolbar } from "./studio-toolbar";

export function NoteEditorScreen({
  projectId,
  trackId,
  clipId,
  onBack,
  onImportResource,
}: {
  onImportResource: (resource: Resource) => Promise<void>;
  projectId: number | null;
  trackId: number | null;
  clipId: number | null;
  onBack: () => void;
  onAddLayer: () => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [noteSettingsIndex, setNoteSettingsIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState<MidiNoteDto[]>([]);
  const lengthCells = 1;
  const [initialPitch, setInitialPitch] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  const clip =
    track?.clips.find((item) => item.clipId === clipId && item.clipType === "MIDI") ??
    (clipId === null ? track?.clips.find((item) => item.clipType === "MIDI") : undefined);
  const editable = Boolean(
    composition &&
    track &&
    (clip
      ? clip.ownerId === composition.viewerPermission.userId
      : track.ownerId === composition.viewerPermission.userId &&
        composition.viewerPermission.canContribute),
  );

  const maxTick = composition?.project.maxTick ?? 57_600;
  const clipStartTick = clip?.startTick ?? 0;
  const preview = useMemo(() => {
    if (!composition || !track) return null;
    const previewClip = clip
      ? { ...clip, midiNotes: notes }
      : {
          clipId: -1,
          ownerId: composition.viewerPermission.userId,
          clipType: "MIDI" as const,
          sourceType: "MIDI_INPUT",
          mediaFileId: null,
          mediaUrl: null,
          startTick: 0,
          durationTick: maxTick,
          startTimeMs: 0,
          durationMs: composition.project.maxDurationMs,
          clipOffsetMs: 0,
          approvalStatus: "DRAFT",
          midiNotes: notes,
        };
    return {
      ...composition,
      tracks: [{ ...track, isMuted: false, isSolo: false, clips: [previewClip] }],
    };
  }, [composition, track, clip, notes, maxTick]);
  const playback = useCompositionPlayback(preview);
  const stepTick = ((composition?.project.ppq ?? 480) * 2) / playback.signature.denominator;

  useEffect(() => {
    if (projectId == null || trackId == null) return;
    let cancelled = false;
    getComposition(projectId)
      .then((result) => {
        if (cancelled) return;
        const track = result.tracks.find((item) => item.trackId === trackId);
        const found =
          clipId === null
            ? track?.clips.find((item) => item.clipType === "MIDI")
            : track?.clips.find((item) => item.clipId === clipId && item.clipType === "MIDI");
        setComposition(result);
        setNotes(found?.midiNotes ?? []);
        setInitialPitch(found?.midiNotes?.[0]?.pitch ?? 60);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorText(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, trackId, clipId]);

  async function save(afterSave = onBack) {
    if (!composition || !track || !editable || busy) return;
    setBusy(true);
    setError(null);
    try {
      const durationTick = Math.max(
        clip?.durationTick ?? 0,
        stepTick,
        ...notes.map((note) => note.startTick + note.durationTick),
      );
      if (clip) await saveMidiClip(clip.clipId, clipStartTick, durationTick, notes);
      else
        await createMidiClip(composition.project.projectId, track.trackId, 0, durationTick, notes);
      setComposition(await getComposition(composition.project.projectId));
      afterSave();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!composition || !track)
    return (
      <div
        className={cn(studioStyles.studio, studioStyles.studioState)}
        role={error ? "alert" : "status"}
      >
        {error ??
          (projectId == null || trackId == null
            ? "편집할 MIDI를 작곡 화면에서 먼저 선택해주세요."
            : composition
              ? "선택한 MIDI 레이어를 찾을 수 없습니다."
              : "피아노롤을 불러오는 중입니다.")}
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  return (
    <div className={cn(studioStyles.studio, "note-editor")}>
      <StudioToolbar
        signature={playback.signature}
        onSignature={
          composition.viewerPermission.canEdit
            ? (value) => {
                playback.pause();
                playback.setSignature(value);
              }
            : undefined
        }
        title={`${track.name} · 피아노롤`}
        bpm={composition.project.bpm}
        playing={playback.playing}
        positionMs={playback.positionMs}
        onPlay={() => {
          void playback.play();
        }}
        onPause={playback.pause}
        onBack={() => {
          if (editable) void save();
          else onBack();
        }}
        piano
        volume={playback.volume}
        onVolume={playback.setVolume}
        metronome={playback.metronome}
        onMetronome={() => playback.setMetronome((value) => !value)}
        onImportSource={editable ? () => void save(() => setShowSources(true)) : undefined}
        onAdd={() => {
          if (editable) void save();
          else onBack();
        }}
      ></StudioToolbar>
      {error && (
        <p className={studioStyles.studioError} role="alert">
          {error}
        </p>
      )}
      {!editable && (
        <p className={studioStyles.studioError}>
          다른 참여자의 MIDI는 수정할 수 없습니다. 새 클립을 만들어 주세요.
        </p>
      )}
      {showSources && (
        <StudioSourceDialog
          midiOnly
          onClose={() => setShowSources(false)}
          onAudio={async () => {
            throw new Error("피아노롤에는 MIDI 노트만 추가할 수 있습니다.");
          }}
          onResource={async (resource) => {
            await onImportResource(resource);
            const latest = await getComposition(composition.project.projectId);
            const updatedTrack = latest.tracks.find((item) => item.trackId === track.trackId);
            const updatedClip =
              updatedTrack?.clips.find(
                (item) => item.clipId === clipId && item.clipType === "MIDI",
              ) ?? updatedTrack?.clips.find((item) => item.clipType === "MIDI");
            setComposition(latest);
            setNotes(updatedClip?.midiNotes ?? []);
            setShowSources(false);
          }}
        />
      )}
      {noteSettingsIndex !== null && notes[noteSettingsIndex] && (
        <NoteSettingsDialog
          note={notes[noteSettingsIndex]}
          instrument={track.instrument}
          stepTick={stepTick}
          maxTick={maxTick - clipStartTick}
          onClose={() => setNoteSettingsIndex(null)}
          onChange={(updated) =>
            setNotes((current) => {
              if (
                current.some(
                  (note, index) =>
                    index !== noteSettingsIndex &&
                    note.pitch === updated.pitch &&
                    updated.startTick < note.startTick + note.durationTick &&
                    updated.startTick + updated.durationTick > note.startTick,
                )
              )
                return current;
              return current.map((note, index) => (index === noteSettingsIndex ? updated : note));
            })
          }
        />
      )}
      <TeamPianoRoll
        signature={playback.signature}
        onSettings={setNoteSettingsIndex}
        notes={notes}
        setNotes={setNotes}
        stepTick={stepTick}
        maxTick={maxTick - clipStartTick}
        lengthCells={lengthCells}
        editable={editable}
        positionMs={playback.positionMs}
        maxDurationMs={composition.project.maxDurationMs}
        onSeek={playback.seek}
        initialPitch={initialPitch}
      />
    </div>
  );
}

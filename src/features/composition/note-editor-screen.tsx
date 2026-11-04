import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
import { NoteSettingsDialog } from "./note-settings-dialog";
import { useCompositionPlayback } from "./use-composition-playback";
import { StudioSourceDialog } from "./studio-source-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import {
  getComposition,
  updateProjectTiming,
  updateTrackInstrument,
  type CompositionDto,
  type MidiNoteDto,
} from "@/lib/api/composition";
import { apiOrigin } from "@/lib/api/client";
import { errorText } from "./studio-helpers";
import { StudioToolbar } from "./studio-toolbar";
import { useEditorDraft } from "./use-editor-draft";
import { resourceNotes } from "./composition-actions";
import { findInstrument, invalidPitchesFor } from "./instrument-catalog";
import { supportsMidi } from "./instrument-parts";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export function NoteEditorScreen({
  projectId,
  trackId,
  clipId,
  onBack,
}: {
  projectId: number | null;
  trackId: number | null;
  clipId: number | null;
  onBack: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (projectId === null) return;
    let active = true;
    getComposition(projectId)
      .then((result) => {
        if (active) setComposition(result);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, [projectId, currentUserId]);
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  if (!composition || !track || composition.viewerPermission.userId !== currentUserId)
    return (
      <div className={cn(studioStyles.studio, studioStyles.studioState)}>
        <p role={error ? "alert" : "status"}>
          {error ??
            (composition ? "선택한 레이어를 찾을 수 없습니다." : "피아노롤을 불러오는 중입니다.")}
        </p>
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  return (
    <LoadedNoteEditor
      key={`${projectId}:${trackId}:${currentUserId}`}
      initial={composition}
      trackId={track.trackId}
      requestedClipId={clipId}
      onBack={onBack}
    />
  );
}

function LoadedNoteEditor({
  initial,
  trackId,
  requestedClipId,
  onBack,
}: {
  initial: CompositionDto;
  trackId: number;
  requestedClipId: number | null;
  onBack: () => void;
}) {
  const [composition, setComposition] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [targetClipId, setTargetClipId] = useState(requestedClipId);
  const [showSources, setShowSources] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [noteSettingsIndex, setNoteSettingsIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition.tracks.find((item) => item.trackId === trackId)!;
  const clip = track.clips.find((item) => item.clipId === targetClipId && item.clipType === "MIDI");
  const editable =
    track.ownerId === composition.viewerPermission.userId &&
    supportsMidi(track.instrument) &&
    ["DRAFT", "IN_PROGRESS"].includes(composition.project.status) &&
    (composition.viewerPermission.canContribute || composition.viewerPermission.canEdit);
  const context = useMemo(
    () => ({
      origin: apiOrigin(),
      userId: initial.viewerPermission.userId,
      projectId: initial.project.projectId,
      trackId,
      targetClipId,
    }),
    [initial, trackId, targetClipId],
  );
  // Keep the original base snapshot stable across timing/instrument refreshes; those do not replace working notes.
  const baseClip = useMemo(() => {
    const original = baseline.tracks
      .find((item) => item.trackId === trackId)
      ?.clips.find((item) => item.clipId === targetClipId);
    return original
      ? {
          startTick: original.startTick,
          durationTick: original.durationTick,
          midiNotes: original.midiNotes ?? [],
        }
      : null;
  }, [baseline, trackId, targetClipId]);
  const content = useMemo(
    () => baseClip ?? { startTick: 0, durationTick: initial.project.ppq, midiNotes: [] },
    [baseClip, initial],
  );
  const recoverCommitted = useCallback(
    (id: number) => {
      void getComposition(initial.project.projectId)
        .then((latest) => {
          setComposition(latest);
          setBaseline(latest);
          setTargetClipId(id);
        })
        .catch((cause) => setError(errorText(cause)));
    },
    [initial],
  );
  const draft = useEditorDraft({
    context,
    content,
    baseClip,
    enabled: editable,
    onCommittedRecovery: recoverCommitted,
  });
  const working = draft.state?.content ?? content;
  const notes = working.midiNotes;
  const maxTick = composition.project.maxTick - working.startTick;
  const setNotes: Dispatch<SetStateAction<MidiNoteDto[]>> = (action) => {
    if (!draft.session || !editable) return;
    const current = draft.session.getSnapshot().content;
    const next = typeof action === "function" ? action(current.midiNotes) : action;
    const instrument = findInstrument(track.instrument);
    if (
      !instrument ||
      invalidPitchesFor(
        instrument,
        next.map((note) => note.pitch),
      ).length
    ) {
      setError("이 악기에서 지원하지 않는 음입니다. 드럼은 35~81번을 사용해주세요.");
      return;
    }
    const durationTick = Math.max(
      content.durationTick,
      composition.project.ppq / 4,
      ...next.map((note) => note.startTick + note.durationTick),
    );
    if (current.startTick + durationTick > composition.project.maxTick) {
      setError("노트가 곡의 최대 길이를 초과합니다.");
      return;
    }
    draft.session.edit({ ...current, durationTick, midiNotes: next });
  };
  const preview = useMemo<CompositionDto>(
    () => ({
      ...composition,
      tracks: [
        {
          ...track,
          isMuted: false,
          isSolo: false,
          clips: [
            {
              ...(clip ?? {
                clipId: -1,
                ownerId: context.userId,
                clipType: "MIDI" as const,
                sourceType: "MIDI_INPUT",
                mediaFileId: null,
                mediaUrl: null,
                startTimeMs: 0,
                durationMs:
                  (working.durationTick * 60000) /
                  (composition.project.bpm * composition.project.ppq),
                clipOffsetMs: 0,
                approvalStatus: "DRAFT",
              }),
              ...working,
            },
          ],
        },
      ],
    }),
    [composition, track, clip, context.userId, working],
  );
  const playback = useCompositionPlayback(preview);
  const stepTick = (composition.project.ppq * 2) / playback.signature.denominator;
  const canTime =
    composition.project.ownerId === context.userId &&
    ["DRAFT", "IN_PROGRESS"].includes(composition.project.status);
  async function action(run: () => Promise<unknown>, leave = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
      if (leave) onBack();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  function exportRecovery() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(draft.session?.getLocalRecord() ?? { context, content: working }, null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `midi-recovery-${trackId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const draftLabels = {
    idle: "변경 없음",
    dirty: "변경됨",
    saving: "저장 중",
    saved: "개인 초안 저장됨",
    local: "서버 저장 실패 · 로컬 복구본 유지",
    error: "저장 실패",
    conflict: "충돌",
  };
  return (
    <div className={cn(studioStyles.studio, "note-editor")}>
      <StudioToolbar
        signature={playback.signature}
        title={`${track.name} · 피아노롤`}
        bpm={composition.project.bpm}
        onTiming={
          canTime
            ? async ({ bpm, signature }) => {
                playback.pause();
                await updateProjectTiming(context.projectId, {
                  bpm,
                  timeSignatureNumerator: signature.numerator,
                  timeSignatureDenominator: signature.denominator,
                });
                setComposition(await getComposition(context.projectId));
              }
            : undefined
        }
        instrument={
          editable
            ? {
                value: track.instrument,
                mode: "midi",
                tracks: composition.tracks,
                currentTrackId: trackId,
                onPreview: playback.previewInstrument,
                onConfirm: async (instrument) => {
                  const definition = findInstrument(instrument);
                  if (
                    !definition ||
                    invalidPitchesFor(
                      definition,
                      notes.map((note) => note.pitch),
                    ).length
                  )
                    throw new Error("현재 노트에 이 악기에서 지원하지 않는 음이 있습니다.");
                  playback.pause();
                  await updateTrackInstrument(context.projectId, trackId, instrument);
                  setComposition(await getComposition(context.projectId));
                },
              }
            : undefined
        }
        playing={playback.playing}
        positionMs={playback.positionMs}
        onPlay={() => void playback.play()}
        onPause={playback.pause}
        onBack={() => (editable ? setLeaving(true) : onBack())}
        piano
        volume={playback.volume}
        onVolume={playback.setVolume}
        metronome={playback.metronome}
        onMetronome={() => playback.setMetronome((value) => !value)}
        onImportSource={editable && draft.session ? () => setShowSources(true) : undefined}
        onAdd={() => (editable ? setLeaving(true) : onBack())}
        addLabel="저장 및 나가기"
      />
      {editable && (
        <p role="status">
          {draft.state ? draftLabels[draft.state.status] : "개인 초안 불러오는 중"}
        </p>
      )}
      {(error || playback.error || draft.loadError || draft.state?.error) && (
        <p className={studioStyles.studioError} role="alert">
          {error ?? playback.error ?? draft.loadError ?? draft.state?.error}
        </p>
      )}
      {draft.loadError && !draft.session && (
        <button onClick={draft.retryLoad}>초안 다시 불러오기</button>
      )}
      {draft.state?.status === "conflict" && (
        <div>
          <button disabled={busy} onClick={() => void action(draft.useServer)}>
            서버본 열기
          </button>
          <button onClick={exportRecovery}>로컬 복구본 내보내기</button>
          <button disabled={busy} onClick={() => void action(draft.keepLocal)}>
            로컬 복구본 명시적으로 재적용
          </button>
        </div>
      )}
      {!editable && <p>내 MIDI 레이어만 수정할 수 있습니다.</p>}
      {showSources && (
        <StudioSourceDialog
          midiOnly
          onClose={() => setShowSources(false)}
          onResource={async (resource) => {
            const after = Math.max(0, ...notes.map((note) => note.startTick + note.durationTick));
            const imported = resourceNotes(resource, composition.project.ppq, after);
            if (imported.some((note) => note.startTick + note.durationTick > maxTick))
              throw new Error("가져올 노트가 곡의 최대 길이를 초과합니다.");
            const definition = findInstrument(track.instrument);
            if (
              !definition ||
              invalidPitchesFor(
                definition,
                imported.map((note) => note.pitch),
              ).length
            )
              throw new Error("가져올 노트에 이 악기에서 지원하지 않는 음이 있습니다.");
            setNotes([...notes, ...imported]);
            setShowSources(false);
          }}
        />
      )}
      {leaving && (
        <CanvasDialog
          className={studioStyles.studioAudioDialogContent}
          titleId="draft-exit-title"
          onClose={() => {
            if (!busy) setLeaving(false);
          }}
        >
          <h2 id="draft-exit-title">개인 초안을 어떻게 할까요?</h2>
          <p>
            저장 후 나가기는 공유 클립에 반영합니다. 초안 유지는 다른 참여자의 공유본을 바꾸지
            않습니다.
          </p>
          <button
            disabled={busy || !draft.session || draft.state?.status === "conflict"}
            onClick={() => void action(draft.commit, true)}
          >
            저장 후 나가기
          </button>
          <button
            disabled={busy || (draft.state?.hasUnsavedChanges && !draft.state.localProtected)}
            onClick={() =>
              void action(async () => {
                if (draft.state?.status !== "conflict")
                  await draft.session?.flush().catch(() => {
                    if (!draft.session?.getSnapshot().localProtected)
                      throw new Error("복구본을 저장하지 못했습니다. 내보내기 후 나가주세요.");
                  });
              }, true)
            }
          >
            개인 초안 유지
          </button>
          <button disabled={busy} onClick={() => void action(draft.discard, true)}>
            버리기
          </button>
          <button onClick={exportRecovery}>복구본 내보내기</button>
          <button disabled={busy} onClick={() => setLeaving(false)}>
            계속 편집
          </button>
        </CanvasDialog>
      )}
      {noteSettingsIndex !== null && notes[noteSettingsIndex] && (
        <NoteSettingsDialog
          note={notes[noteSettingsIndex]}
          instrument={track.instrument}
          stepTick={stepTick}
          maxTick={maxTick}
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
        maxTick={maxTick}
        lengthCells={1}
        editable={editable && Boolean(draft.session) && !busy && draft.state?.status !== "conflict"}
        positionMs={playback.positionMs}
        maxDurationMs={composition.project.maxDurationMs}
        onSeek={playback.seek}
        initialPitch={notes[0]?.pitch ?? 60}
      />
    </div>
  );
}

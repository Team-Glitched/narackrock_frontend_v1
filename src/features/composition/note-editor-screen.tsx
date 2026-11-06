import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CanvasDialog } from "@/components/canvas-dialog";
import { NoteSettingsDialog } from "./note-settings-dialog";
import { useCompositionPlayback } from "./use-composition-playback";
import { StudioSourceDialog } from "./studio-source-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import {
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
import { useNoteEditor } from "./use-note-editor";
import { NoteEditorControls } from "./note-editor-controls";
import { ChordPickerDialog } from "./chord-picker-dialog";
import { useNoteEditorShortcuts } from "./use-note-editor-shortcuts";
import { clipLocalTiming, clipPositionTick, projectPositionMs } from "./clip-local-timing";
import { sameNotes } from "./note-editing";
import { compositionEndMs } from "./composition-playback-timeline";
import { compositionKeys, compositionQuery } from "./composition-queries";

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
  // Layer pages write without touching this cache, so the editor only opens on a response read after mounting.
  const query = useQuery({
    ...compositionQuery(currentUserId, projectId ?? 0),
    enabled: projectId !== null,
    refetchOnMount: "always",
  });
  const editorKey = `${apiOrigin()}:${projectId}:${trackId}:${clipId}:${currentUserId}`;
  const composition = query.data?.viewerPermission.userId === currentUserId ? query.data : undefined;
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  const requestedClip = track?.clips.find((item) => item.clipId === clipId && item.clipType === "MIDI");
  const canCreateClip = track && composition && track.ownerId === currentUserId &&
    supportsMidi(track.instrument) && ["DRAFT", "IN_PROGRESS"].includes(composition.project.status) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus) &&
    (composition.viewerPermission.canContribute || composition.viewerPermission.canEdit);
  const missingClip = (clipId !== null && !requestedClip) || (clipId === null && !canCreateClip);
  const ready = query.isFetchedAfterMount && !query.error && Boolean(track) && !missingClip;
  // Once open, later refreshes (timing, instrument, committed recovery) never close the editor over a moved clip.
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  if (ready && openedKey !== editorKey) setOpenedKey(editorKey);
  if (!composition || !track || !(ready || openedKey === editorKey)) {
    const error = query.isFetchedAfterMount && query.error ? errorText(query.error) : null;
    return (
      <div className={cn(studioStyles.studio, studioStyles.studioState)}>
        <p role={error ? "alert" : "status"}>
          {error ??
            (query.isFetchedAfterMount && query.data
              ? "선택한 MIDI 클립 또는 레이어를 찾을 수 없습니다."
              : "피아노롤을 불러오는 중입니다.")}
        </p>
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  }
  return (
    <LoadedNoteEditor
      key={editorKey}
      composition={composition}
      trackId={track.trackId}
      requestedClipId={clipId}
      onBack={onBack}
    />
  );
}

function LoadedNoteEditor({
  composition,
  trackId,
  requestedClipId,
  onBack,
}: {
  /** The live project; working notes and their base snapshot are kept apart from it. */
  composition: CompositionDto;
  trackId: number;
  requestedClipId: number | null;
  onBack: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [initial] = useState(composition);
  const [baseline, setBaseline] = useState(composition);
  const [targetClipId, setTargetClipId] = useState(requestedClipId);
  const [showSources, setShowSources] = useState(false);
  const [showChords, setShowChords] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [noteSettingsIndex, setNoteSettingsIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition.tracks.find((item) => item.trackId === trackId)!;
  const clip = track.clips.find((item) => item.clipId === targetClipId && item.clipType === "MIDI");
  const clipUnavailable = targetClipId !== null && !clip;
  const editable = !clipUnavailable &&
    track.ownerId === composition.viewerPermission.userId &&
    supportsMidi(track.instrument) &&
    ["DRAFT", "IN_PROGRESS"].includes(composition.project.status) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus) &&
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
      void queryClient
        .fetchQuery({
          ...compositionQuery(initial.viewerPermission.userId, initial.project.projectId),
          staleTime: 0,
        })
        .then((latest) => {
          setBaseline(latest);
          setTargetClipId(id);
        })
        .catch((cause) => setError(errorText(cause)));
    },
    [initial, queryClient],
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
  const timing = clipLocalTiming(
    composition.project.bpm, composition.project.ppq, composition.project.maxTick, working.startTick,
  );
  const maxTick = timing.maxTick;
  function commitNotes(next: MidiNoteDto[]): boolean {
    const session = draft.session;
    if (!session || session.isDisposed() || !editable || busy ||
        session.getSnapshot().status === "conflict") return false;
    const current = session.getSnapshot().content;
    const instrument = findInstrument(track.instrument);
    if (
      !instrument ||
      invalidPitchesFor(
        instrument,
        next.map((note) => note.pitch),
      ).length
    ) {
      setError("이 악기에서 지원하지 않는 음입니다. 드럼은 35~81번을 사용해주세요.");
      return false;
    }
    const durationTick = Math.max(
      content.durationTick,
      current.durationTick,
      Math.ceil(composition.project.ppq / 4),
      ...next.map((note) => note.startTick + note.durationTick),
    );
    if (current.startTick + durationTick > composition.project.maxTick) {
      setError("노트가 곡의 최대 길이를 초과합니다.");
      return false;
    }
    session.edit({ ...current, durationTick, midiNotes: next });
    const accepted = session.getSnapshot().content;
    const success = accepted.durationTick === durationTick && sameNotes(accepted.midiNotes, next);
    if (success) setError(null);
    return success;
  }
  const preview = useMemo<CompositionDto | null>(
    () => clipUnavailable ? null : ({
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
    [composition, track, clip, clipUnavailable, context.userId, working],
  );
  const playback = useCompositionPlayback(preview, {
    scopeKey: JSON.stringify([apiOrigin(), currentUserId, context.projectId, trackId, targetClipId]),
  });
  const positionTick = clipPositionTick(playback.positionMs, timing);
  const editor = useNoteEditor({
    contextKey: JSON.stringify([
      context.origin, context.userId, context.projectId, trackId, targetClipId,
      draft.state?.draftId ?? (editable ? "loading" : "readonly"),
    ]),
    notes,
    ppq: composition.project.ppq,
    signature: playback.signature,
    instrument: track.instrument,
    bounds: { maxTick, minPitch: 0, maxPitch: 127 },
    editable: editable && Boolean(draft.session) && !busy && draft.state?.status !== "conflict",
    onCommit: commitNotes,
  });
  // Settings follow their note through accepted edits and close on delete/undo/redo/reset.
  const [seenChange, setSeenChange] = useState(editor.lastChange);
  if (seenChange !== editor.lastChange) {
    setSeenChange(editor.lastChange);
    const change = editor.lastChange;
    if (change)
      setNoteSettingsIndex((index) => index === null ? null :
        change.type !== "edit" || change.commandType === "delete"
          ? null : change.indexMap[index] ?? null);
  }
  const [wasEditable, setWasEditable] = useState(editor.editable);
  if (wasEditable !== editor.editable) {
    setWasEditable(editor.editable);
    if (!editor.editable) {
      setNoteSettingsIndex(null);
      setShowChords(false);
      setShowSources(false);
    }
  }
  function play() {
    if (playback.positionMs < timing.clipStartMs ||
        (preview && playback.positionMs >= compositionEndMs(preview, preview.tracks)))
      playback.seek(timing.clipStartMs);
    void playback.play().catch((cause) => setError(errorText(cause)));
  }
  useNoteEditorShortcuts({
    editor, positionTick, playing: playback.playing, onPlay: play, onPause: playback.pause,
  });
  const canTime = editable && !busy && Boolean(draft.session) &&
    draft.state?.status !== "conflict" && composition.project.ownerId === context.userId;
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
  if (clipUnavailable) return (
    <div className={cn(studioStyles.studio, studioStyles.studioState)}>
      <p role="alert">선택한 MIDI 클립을 찾을 수 없습니다.</p>
      <button onClick={onBack}>돌아가기</button>
    </div>
  );
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
                // Only the shared project is re-read; working notes stay in the draft session.
                await queryClient.invalidateQueries(
                  { queryKey: compositionKeys.detail(context.userId, context.projectId) },
                  { throwOnError: true },
                );
              }
            : undefined
        }
        instrument={
          editor.editable
            ? {
                value: track.instrument,
                mode: "midi",
                tracks: composition.tracks,
                currentTrackId: trackId,
                onPreview: playback.previewInstrument,
                onStopPreview: playback.stopPreview,
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
                  await queryClient.invalidateQueries(
                    { queryKey: compositionKeys.detail(context.userId, context.projectId) },
                    { throwOnError: true },
                  );
                },
              }
            : undefined
        }
        playing={playback.playing}
        positionMs={positionTick * timing.tickMs}
        onPlay={play}
        onPause={playback.pause}
        onRewind={() => playback.seek(projectPositionMs(0, timing))}
        onBack={() => (editable ? setLeaving(true) : onBack())}
        piano
        volume={playback.volume}
        onVolume={playback.setVolume}
        metronome={playback.metronome}
        onMetronome={() => playback.setMetronome((value) => !value)}
        onImportSource={editor.editable ? () => setShowSources(true) : undefined}
        onAdd={editable ? () => setLeaving(true) : undefined}
        addLabel="저장 및 나가기"
      />
      {editable && (
        <NoteEditorControls
          editor={editor}
          positionTick={positionTick}
          onSettings={() => {
            if (editor.selection.length === 1) setNoteSettingsIndex(editor.selection[0]);
          }}
          onChord={() => {
            playback.pause();
            setShowChords(true);
          }}
        />
      )}
      {editable && (
        <p role="status" className="m-0 shrink-0 px-3 py-0.5 text-caption leading-[16px] text-app-muted">
          {draft.state ? draftLabels[draft.state.status] : "개인 초안 불러오는 중"}
        </p>
      )}
      {(error || playback.error || editor.error || draft.loadError || draft.state?.error) && (
        <p className={studioStyles.studioError} role="alert">
          {error ?? playback.error ?? editor.error ?? draft.loadError ?? draft.state?.error}
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
      {showSources && editor.editable && (
        <StudioSourceDialog
          midiOnly
          onClose={() => setShowSources(false)}
          onResource={async (resource) => {
            const after = Math.max(0, ...notes.map((note) => note.startTick + note.durationTick));
            const imported = resourceNotes(resource, composition.project.ppq, after);
            if (!editor.execute({ type: "insert", notes: imported }))
              throw new Error("가져올 노트를 추가하지 못했습니다. 음역, 겹침, 곡의 최대 길이를 확인해주세요.");
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
      {showChords && editor.editable && (
        <ChordPickerDialog
          editor={editor}
          ppq={composition.project.ppq}
          signature={playback.signature}
          positionTick={positionTick}
          onClose={() => setShowChords(false)}
        />
      )}
      {noteSettingsIndex !== null && editor.editable && editor.snapshot.notes[noteSettingsIndex] && (
        <NoteSettingsDialog
          key={`${noteSettingsIndex}:${editor.lastChange?.revision ?? 0}`}
          note={editor.snapshot.notes[noteSettingsIndex]}
          instrument={track.instrument}
          stepTick={editor.bounds.stepTick}
          maxTick={maxTick}
          onClose={() => setNoteSettingsIndex(null)}
          onApply={(note) => editor.execute({ type: "replace", index: noteSettingsIndex, note })}
        />
      )}
      <TeamPianoRoll
        editor={editor}
        signature={playback.signature}
        ppq={composition.project.ppq}
        maxTick={maxTick}
        positionTick={positionTick}
        onSeekTick={(tick) => playback.seek(projectPositionMs(tick, timing))}
        playing={playback.playing}
        instrument={track.instrument}
        onAudition={(pitch) => void playback.audition(pitch, track.instrument)}
        onSettings={editor.editable ? setNoteSettingsIndex : undefined}
        initialPitch={notes[0]?.pitch ?? 60}
      />
    </div>
  );
}

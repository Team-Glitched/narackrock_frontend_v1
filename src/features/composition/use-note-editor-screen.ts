import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompositionPlayback } from "./use-composition-playback";
import {
  insertOpenSourceClip,
  updateProjectTiming,
  updateTrackInstrument,
  type CompositionDto,
  type MidiNoteDto,
  type TrackDto,
} from "@/lib/api/composition";
import { apiOrigin } from "@/lib/api/client";
import { saveFile } from "@/lib/native-app";
import { errorText } from "./studio-helpers";
import { useEditorDraft } from "./use-editor-draft";
import { cancelEmptyLayer, resourceNotes } from "./composition-actions";
import { findInstrument, invalidPitchesFor } from "./instrument-catalog";
import { supportsMidi } from "./instrument-parts";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useNoteEditor } from "./use-note-editor";
import { clipLocalTiming, clipPositionTick, projectPositionMs } from "./clip-local-timing";
import { sameNotes } from "./note-editing";
import { compositionEndMs } from "./composition-playback-timeline";
import { compositionKeys, compositionQuery } from "./composition-queries";
import { getOpenSourcePlayback, type OpenSourceSummary } from "@/lib/api/open-sources";
import type { Resource } from "@/features/workspace/workspace-store";
import type { ProjectTiming } from "./project-timing";
import type { InstrumentChoice } from "./instrument-dialog";
import { openSourceStartTick, insertThenRefresh } from "./open-source-insertion";
import { useNoteEditorDialogs } from "./use-note-editor-native";

/** The playback answer may omit the length; the audio metadata is read then. */
async function openSourceDurationMs(openSourceId: number): Promise<number> {
  const playback = await getOpenSourcePlayback(openSourceId);
  if (playback.durationMs && playback.durationMs > 0) return playback.durationMs;
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const audio = new Audio();
  audio.preload = "metadata";
  audio.onloadedmetadata = () =>
    Number.isFinite(audio.duration) && audio.duration > 0
      ? resolve(Math.round(audio.duration * 1000))
      : reject(new Error("샘플 음원 길이를 확인하지 못했습니다."));
  audio.onerror = () => reject(new Error("샘플 음원을 불러오지 못했습니다."));
  audio.src = playback.audioUrl;
  return promise;
}

export type NoteEditorLoad =
  | {
      composition: CompositionDto;
      track: TrackDto;
      editorKey: string;
      state: "ready";
      message: null;
    }
  | {
      composition: null;
      track: null;
      editorKey: string;
      /** Still loading, or settled without an editor to open (load error, or no such clip/layer). */
      state: "loading" | "missing" | "error";
      message: string;
    };

/**
 * Loads the project of a note editor route and decides whether the editor may open: the requested MIDI clip
 * exists, or no clip was requested and the viewer may create one on this own, MIDI-capable layer.
 */
export function useNoteEditorLoad(
  projectId: number | null,
  trackId: number | null,
  clipId: number | null,
): NoteEditorLoad {
  const currentUserId = useCurrentUserId();
  // Layer pages write without touching this cache, so the editor only opens on a response read after mounting.
  const query = useQuery({
    ...compositionQuery(currentUserId, projectId ?? 0),
    enabled: projectId !== null,
    refetchOnMount: "always",
  });
  const editorKey = `${apiOrigin()}:${projectId}:${trackId}:${clipId}:${currentUserId}`;
  const composition =
    query.data?.viewerPermission.userId === currentUserId ? query.data : undefined;
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  const requestedClip = track?.clips.find(
    (item) => item.clipId === clipId && item.clipType === "MIDI",
  );
  const canCreateClip =
    track &&
    composition &&
    track.ownerId === currentUserId &&
    supportsMidi(track.instrument) &&
    ["DRAFT", "IN_PROGRESS"].includes(composition.project.status) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus) &&
    (composition.viewerPermission.canContribute || composition.viewerPermission.canEdit);
  const missingClip = (clipId !== null && !requestedClip) || (clipId === null && !canCreateClip);
  const ready = query.isFetchedAfterMount && !query.error && Boolean(track) && !missingClip;
  // Once open, later refreshes (timing, instrument, committed recovery) never close the editor over a moved clip.
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  if (ready && openedKey !== editorKey) setOpenedKey(editorKey);
  if (composition && track && (ready || openedKey === editorKey))
    return { composition, track, editorKey, state: "ready", message: null };
  const error = query.isFetchedAfterMount && query.error ? errorText(query.error) : null;
  if (error !== null)
    return { composition: null, track: null, editorKey, state: "error", message: error };
  return query.isFetchedAfterMount && query.data
    ? {
        composition: null,
        track: null,
        editorKey,
        state: "missing",
        message: "선택한 MIDI 클립 또는 레이어를 찾을 수 없습니다.",
      }
    : {
        composition: null,
        track: null,
        editorKey,
        state: "loading",
        message: "피아노롤을 불러오는 중입니다.",
      };
}

export const draftLabels = {
  idle: "변경 없음",
  dirty: "변경됨",
  saving: "저장 중",
  saved: "개인 초안 저장됨",
  local: "서버 저장 실패 · 로컬 복구본 유지",
  error: "저장 실패",
  conflict: "충돌",
};

export type NoteEditorScreenState = ReturnType<typeof useNoteEditorScreen>;

/**
 * Everything the loaded note editor shows and does, shared by the web screen and the app's native screen:
 * the personal draft, the note editor controller, playback, dialogs and the exit flow.
 */
export function useNoteEditorScreen({
  composition,
  trackId,
  requestedClipId,
  onBack,
  onOpenLayers,
  portrait,
}: {
  /** The live project; working notes and their base snapshot are kept apart from it. */
  composition: CompositionDto;
  trackId: number;
  requestedClipId: number | null;
  onBack: () => void;
  onOpenLayers: () => void;
  portrait: boolean;
}) {
  const currentUserId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [initial] = useState(composition);
  const [baseline, setBaseline] = useState(composition);
  const [targetClipId, setTargetClipId] = useState(requestedClipId);
  const [showSources, setShowSources] = useState(false);
  const [exitTarget, setExitTarget] = useState<"studio" | "layers" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition.tracks.find((item) => item.trackId === trackId)!;
  const clip = track.clips.find((item) => item.clipId === targetClipId && item.clipType === "MIDI");
  const clipUnavailable = targetClipId !== null && !clip;
  const editable =
    !clipUnavailable &&
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
    composition.project.bpm,
    composition.project.ppq,
    composition.project.maxTick,
    working.startTick,
  );
  const maxTick = timing.maxTick;
  function commitNotes(next: MidiNoteDto[]): boolean {
    const session = draft.session;
    if (
      !session ||
      session.isDisposed() ||
      !editable ||
      busy ||
      session.getSnapshot().status === "conflict"
    )
      return false;
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
    if (success) {
      setError(null);
      setNotice(null);
    }
    return success;
  }
  const preview = useMemo<CompositionDto | null>(
    () =>
      clipUnavailable
        ? null
        : {
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
          },
    [composition, track, clip, clipUnavailable, context.userId, working],
  );
  const playback = useCompositionPlayback(preview, {
    scopeKey: JSON.stringify([
      apiOrigin(),
      currentUserId,
      context.projectId,
      trackId,
      targetClipId,
    ]),
  });
  const positionTick = clipPositionTick(playback.positionMs, timing);
  const editor = useNoteEditor({
    contextKey: JSON.stringify([
      context.origin,
      context.userId,
      context.projectId,
      trackId,
      targetClipId,
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
  // Each orientation opens with its own bar count: one bar keeps portrait cells wide enough to tap.
  const { setVisibleBars } = editor;
  useEffect(() => setVisibleBars(portrait ? 1 : 2), [portrait, setVisibleBars]);
  const dialogs = useNoteEditorDialogs(editor, () => setShowSources(false));
  function play() {
    if (
      playback.positionMs < timing.clipStartMs ||
      (preview && playback.positionMs >= compositionEndMs(preview, preview.tracks))
    )
      playback.seek(timing.clipStartMs);
    void playback.play().catch((cause) => setError(errorText(cause)));
  }
  const canTime =
    editable &&
    !busy &&
    Boolean(draft.session) &&
    draft.state?.status !== "conflict" &&
    composition.project.ownerId === context.userId;
  async function action(run: () => Promise<unknown>, onSuccess?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
      onSuccess?.();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  function exportRecovery() {
    const record = draft.session?.getLocalRecord() ?? { context, content: working };
    void saveFile(
      new File([JSON.stringify(record, null, 2)], `midi-recovery-${trackId}.json`, {
        type: "application/json",
      }),
    ).catch((cause) => setError(errorText(cause)));
  }
  async function insertOpenSource(source: OpenSourceSummary) {
    const { projectId, bpm, ppq, maxTick: projectMaxTick } = composition.project;
    const ticksPerMs = (bpm * ppq) / 60000;
    const startTick = openSourceStartTick(positionTick, timing, projectMaxTick);
    playback.pause();
    const durationMs = await openSourceDurationMs(source.openSourceId);
    const durationTick = Math.min(Math.ceil(durationMs * ticksPerMs), projectMaxTick - startTick);
    const refreshed = await insertThenRefresh(
      () => insertOpenSourceClip(projectId, trackId, source.openSourceId, startTick, durationTick),
      () =>
        queryClient.invalidateQueries(
          { queryKey: compositionKeys.detail(context.userId, projectId) },
          { throwOnError: true },
        ),
    );
    setShowSources(false);
    setNotice(
      refreshed
        ? `‘${source.title}’을(를) 내 레이어에 오디오로 넣었습니다. 스튜디오에서 확인할 수 있어요.`
        : `‘${source.title}’ 삽입은 완료되었습니다. 화면을 새로 불러오지 못했으니 스튜디오에서 확인해 주세요.`,
    );
  }
  async function importResource(resource: Resource) {
    const after = Math.max(0, ...notes.map((note) => note.startTick + note.durationTick));
    const imported = resourceNotes(resource, composition.project.ppq, after);
    if (!editor.execute({ type: "insert", notes: imported }))
      throw new Error(
        "가져올 노트를 추가하지 못했습니다. 음역, 겹침, 곡의 최대 길이를 확인해주세요.",
      );
    setShowSources(false);
  }
  const onTiming = canTime
    ? async ({ bpm, signature }: ProjectTiming) => {
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
    : undefined;
  const instrumentChoice: InstrumentChoice | undefined = editor.editable
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
    : undefined;
  const isNewEmptyLayer = targetClipId === null && working.midiNotes.length === 0;
  async function discardNewEmptyLayer() {
    await draft.discard();
    await cancelEmptyLayer(context.projectId, trackId);
    await queryClient.invalidateQueries({
      queryKey: compositionKeys.detail(context.userId, context.projectId),
    });
  }
  const saveOrDiscardEmpty = () => (isNewEmptyLayer ? discardNewEmptyLayer() : draft.commit());
  const requestBack = () => {
    if (!editable) onBack();
    else if (isNewEmptyLayer && draft.session && draft.state?.status !== "conflict")
      void action(discardNewEmptyLayer, onBack);
    else setExitTarget("studio");
  };
  const finishExit = exitTarget === "layers" ? onOpenLayers : onBack;
  function openLayerList() {
    if (busy) return;
    if (!editable) onOpenLayers();
    else if (draft.session && draft.state?.status !== "conflict")
      void action(saveOrDiscardEmpty, onOpenLayers);
    else setExitTarget("layers");
  }
  const openSources = editor.editable ? () => setShowSources(true) : undefined;
  const openSettings = () => {
    if (editor.selection.length === 1) dialogs.setSettingsIndex(editor.selection[0]);
  };
  const openChords = () => {
    playback.pause();
    dialogs.setShowChords(true);
  };
  const statusText = editable
    ? (notice ?? (draft.state ? draftLabels[draft.state.status] : "개인 초안 불러오는 중"))
    : null;
  const shownError =
    error ?? playback.error ?? editor.error ?? draft.loadError ?? draft.state?.error ?? null;
  return {
    composition,
    track,
    trackId,
    clipUnavailable,
    editable,
    busy,
    notes,
    timing,
    maxTick,
    positionTick,
    playback,
    draft,
    editor,
    dialogs,
    showSources,
    setShowSources,
    exitTarget,
    setExitTarget,
    statusText,
    shownError,
    onTiming,
    instrumentChoice,
    openSources,
    openSettings,
    openChords,
    openLayerList,
    requestBack,
    play,
    exportRecovery,
    insertOpenSource,
    importResource,
    rewind: () => playback.seek(projectPositionMs(0, timing)),
    seekTick: (tick: number) => playback.seek(projectPositionMs(tick, timing)),
    audition: (pitch: number) => void playback.audition(pitch, track.instrument),
    toggleMetronome: () => playback.setMetronome((value) => !value),
    useServer: () => void action(draft.useServer),
    keepLocal: () => void action(draft.keepLocal),
    /** Exit dialog: "저장 후 나가기". */
    saveAndExit: () => void action(saveOrDiscardEmpty, finishExit),
    /** Exit dialog: "개인 초안 유지". */
    keepAndExit: () =>
      void action(async () => {
        if (isNewEmptyLayer) {
          await discardNewEmptyLayer();
          return;
        }
        if (draft.state?.status !== "conflict")
          await draft.session?.flush().catch(() => {
            if (!draft.session?.getSnapshot().localProtected)
              throw new Error("복구본을 저장하지 못했습니다. 내보내기 후 나가주세요.");
          });
      }, finishExit),
    /** Exit dialog: "버리기". */
    discardAndExit: () =>
      void action(async () => {
        await draft.discard();
        // A layer that never got a shared clip only existed for this draft; keeping the empty track
        // would use up the viewer's one layer in this song.
        await cancelEmptyLayer(context.projectId, trackId);
        await queryClient.invalidateQueries({
          queryKey: compositionKeys.detail(context.userId, context.projectId),
        });
      }, finishExit),
    /** Exit dialog closes unless an action runs. */
    closeExit: () => {
      if (!busy) setExitTarget(null);
    },
  };
}

import { emptyLayerEditor, layerEditorTarget } from "./studio-layer-editor";
import { contributionsQuery } from "@/features/workspace/workspace-queries";
import { contributionTrackIds } from "@/features/workspace/contribution-presentation";
import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryScope } from "@/lib/query";
import { PublishConfirmation } from "@/features/composition/publish-confirmation";
import { CanvasDialog } from "@/components/canvas-dialog";
import { VolumeDialog } from "@/features/composition/volume-dialog";
import { InstrumentDialog, type InstrumentChoice } from "@/features/composition/instrument-dialog";
import { findInstrument, invalidPitchesFor } from "@/features/composition/instrument-catalog";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { rememberWork } from "@/features/workspace/workspace-store";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { prepareAudioFile } from "@/features/composition/prepare-audio-file";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import {
  canCreateLayer,
  shouldShowContributionSubmit,
  shouldOfferSongPublish,
} from "@/features/composition/contribution-session";
import { completedExportShortId } from "@/features/composition/publish-navigation";
import { pointerAxes, logicalBounds } from "@/features/composition/pointer-coordinates";
import { StudioSourceDialog } from "@/features/composition/studio-source-dialog";
import type { Resource } from "@/features/workspace/workspace-store";
import { signatureGrid, musicalGridBackground } from "@/features/composition/time-signature";
import { MusicalRuler } from "@/features/composition/musical-ruler";
import { TimelineClip } from "@/features/composition/timeline-clip";
import { canMoveClip, overlapsClip } from "@/features/composition/timeline-move";
import type { ProjectTiming } from "@/features/composition/project-timing";
import {
  createAudioClip,
  getExport,
  getPendingContributions,
  publishComposition,
  reviewContribution,
  updateProjectMetadata,
  updateTrackInstrument,
  uploadMedia,
  type CompositionView,
  type ClipDto,
  type CompositionDto,
  type AudioSoundKind,
  analyzeAudioClip,
  type TrackDto,
} from "@/lib/api/composition";
import { errorText } from "./studio-helpers";
import { StudioToolbar } from "./studio-toolbar";
import { ApiError, apiOrigin } from "@/lib/api/client";
import {
  commitEditorDrafts,
  submitEditorDrafts,
  saveEditorDraft,
} from "@/lib/api/composition-drafts";
import { updateProjectTiming } from "@/lib/api/composition";
import { syncProjectEditorDrafts, clearCommittedRecovery } from "./project-editor-drafts";
import { browserDraftStorage } from "./use-editor-draft";
import { listLocalDrafts, readLocalDraft, DraftSession } from "./editor-draft";
import { withPersonalDrafts } from "./draft-preview";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import {
  compositionEntryQuery,
  compositionKeys,
  compositionQuery,
  editorDraftsQuery,
} from "./composition-queries";

export type StudioOptions = {
  onSubmitted: () => void;
  contributionId?: number;
  view?: CompositionView;
  selectMidiLayer: boolean;
  shortId: number | null;
  projectId: number | null;
  onExit: () => void;
  onReturnToShort: (shortId: number) => void;
  onProjectSelected: (id: number) => void;
  onImportResource: (resource: Resource) => Promise<void>;
  onAddLayer: () => void;
  onEditTrack: (trackId: number, clipId: number | null) => void;
};

/** The pending "+ 파일" audio: the chosen file for one of the viewer's tracks. */
export type PendingStudioAudio = { trackId: number; file: File; url: string };

/** The studio's toolbar right button: "제출하기", or the round add button ("곡 올리기" / "레이어 추가"). */
export type StudioPrimary =
  | { kind: "submit"; disabled: boolean }
  | { kind: "publish" | "add"; disabled: boolean; hint: string | null };

/**
 * The studio timeline's data and actions (the shared tracks merged with the viewer's drafts,
 * playback, submit/publish flows, dialogs). The web StudioScreen and the app's native studio both
 * draw this state; the page creates it once.
 */
export function useStudio({
  onSubmitted,
  contributionId,
  view: requestedView = "studio",
  selectMidiLayer,
  shortId,
  projectId,
  onReturnToShort,
  onProjectSelected,
  onAddLayer,
  onEditTrack,
  onImportResource,
  onExit,
}: StudioOptions) {
  const userId = useCurrentUserId();
  const view = contributionId !== undefined ? { contributionId } : requestedView;
  const origin = apiOrigin();
  const queryClient = useQueryClient();
  const [showSources, setShowSources] = useState(false);
  const [trackSettingsId, setTrackSettingsId] = useState<number | null>(null);
  const [instrumentTrackId, setInstrumentTrackId] = useState<number | null>(null);
  // Original audio of a layer, fetched once per media URL for the role chooser's audition.
  const originalAudio = useRef(new Map<string, Promise<File>>());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [metadataAction, setMetadataAction] = useState<"save" | "publish" | null>(null);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishImage, setPublishImage] = useState<File | null>(null);
  const [pendingAudio, setPendingAudio] = useState<PendingStudioAudio | null>(null);
  const [analysisClip, setAnalysisClip] = useState<ClipDto | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const activeAnalysis = useRef(false);
  // A short opens its project; the shared tracks and personal drafts are then read together.
  const entry = useQuery({
    ...compositionEntryQuery(userId, shortId ?? 0),
    enabled: shortId != null,
  });
  const loadedProjectId = shortId == null ? projectId : (entry.data?.projectId ?? null);
  // Layer pages write without touching this cache, so opening the studio always re-reads the project.
  const compositionResult = useQuery({
    ...compositionQuery(userId, loadedProjectId ?? 0, view),
    enabled: loadedProjectId !== null,
    refetchOnMount: "always",
  });
  const readOnly =
    view !== "working" && !(view === "studio" && compositionResult.data?.viewerPermission.canEdit);
  const draftsResult = useQuery({
    ...editorDraftsQuery(userId, loadedProjectId ?? 0),
    enabled: loadedProjectId !== null && !readOnly,
    refetchOnMount: "always",
  });
  const composition =
    compositionResult.data && (readOnly || draftsResult.data) ? compositionResult.data : null;
  const personalDrafts = draftsResult.data;
  const requestList = useQuery({
    ...contributionsQuery(userId, loadedProjectId ?? 0),
    enabled: contributionId != null && loadedProjectId !== null,
  });
  const highlightedRequest = requestList.data?.find(
    (item) => item.contributionId === contributionId,
  );
  const highlightedTracks = useMemo(
    () => contributionTrackIds(highlightedRequest?.items ?? [], composition?.tracks ?? []),
    [highlightedRequest, composition],
  );
  const loadFailure =
    entry.error ?? compositionResult.error ?? (readOnly ? null : draftsResult.error);
  const preview = useMemo(() => {
    if (!composition || composition.viewerPermission.userId !== userId) return null;
    if (readOnly) return composition;
    if (!personalDrafts) return null;
    const local = listLocalDrafts(
      browserDraftStorage(),
      apiOrigin(),
      composition.viewerPermission.userId,
      composition.project.projectId,
    ).filter((draft) => draft.dirty || draft.pending);
    const merged = [
      ...personalDrafts.filter(
        (remote) =>
          !local.some(
            (item) => item.trackId === remote.trackId && item.targetClipId === remote.targetClipId,
          ),
      ),
      ...local,
    ];
    return withPersonalDrafts(composition, merged);
  }, [composition, personalDrafts, userId, readOnly]);
  const playback = useCompositionPlayback(preview, {
    scopeKey: JSON.stringify([
      origin,
      userId,
      projectId ?? composition?.project.projectId ?? null,
      view,
    ]),
  });

  useEffect(
    () => () => {
      if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
    },
    [pendingAudio],
  );

  // A different route/account/backend starts without the previous screen's dialogs and errors.
  const loadKey = JSON.stringify([shortId, projectId, userId, origin, view]);
  const [loadedKey, setLoadedKey] = useState(loadKey);
  if (loadedKey !== loadKey) {
    setLoadedKey(loadKey);
    setTrackSettingsId(null);
    setInstrumentTrackId(null);
    setError(null);
  }
  useEffect(() => {
    const audio = originalAudio.current;
    return () => audio.clear();
  }, [loadKey]);
  useEffect(() => {
    if (!composition) return;
    try {
      rememberWork(composition, shortId);
    } catch {
      /* The server project remains available if browser storage is full. */
    }
    if (composition.project.projectId !== projectId)
      onProjectSelected(composition.project.projectId);
  }, [composition, shortId, projectId, onProjectSelected]);

  /** Plays the layer's own trimmed server audio; the media is fetched once per URL in this scope. */
  async function previewOriginal(clip: ClipDto | undefined) {
    if (!clip?.mediaUrl) throw new Error("미리 들을 원본 오디오가 없습니다.");
    const url = clip.mediaUrl;
    let file = originalAudio.current.get(url);
    if (!file) {
      file = fetch(url).then(async (response) => {
        if (!response.ok)
          throw new Error(`원본 오디오를 불러오지 못했습니다. (${response.status})`);
        return new File([await response.blob()], "original");
      });
      originalAudio.current.set(url, file);
      file.catch(() => originalAudio.current.delete(url));
    }
    await playback.previewAudio({
      file: await file,
      selection: { startMs: clip.clipOffsetMs, endMs: clip.clipOffsetMs + clip.durationMs },
    });
  }

  /** Re-reads the shared tracks and personal drafts; a failed read is reported to the caller. */
  async function refresh() {
    if (composition)
      await queryClient.invalidateQueries(
        { queryKey: compositionKeys.project(userId, composition.project.projectId) },
        { throwOnError: true },
      );
  }
  function canAnalyze(clip: ClipDto) {
    return clip.clipType === "AUDIO" && clip.clipId > 0 && clip.ownerId === userId &&
      clip.approvalStatus !== "REJECTED" &&
      Boolean(composition?.viewerPermission.canEdit || composition?.viewerPermission.canContribute) &&
      ["FILE_UPLOAD", "RECORDING"].includes(clip.sourceType);
  }
  function openAnalysis(clip: ClipDto) {
    if (!canAnalyze(clip) || activeAnalysis.current) return;
    playback.pause();
    setAnalysisError(null);
    setAnalysisClip(clip);
  }
  async function analyze(kind: AudioSoundKind, force: boolean) {
    if (!analysisClip || !composition || activeAnalysis.current) return;
    activeAnalysis.current = true;
    setAnalysisBusy(true);
    setAnalysisError(null);
    try {
      const projectId = composition.project.projectId;
      const reply = await analyzeAudioClip(projectId, analysisClip.clipId, kind, force);
      queryClient.setQueryData<CompositionDto>(compositionKeys.detail(userId, projectId), (old) =>
        old ? {
          ...old,
          tracks: old.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) =>
            clip.clipId === analysisClip.clipId ? { ...clip, audioAnalysis: reply } : clip,
          ) })),
        } : old);
      setAnalysisClip(null);
      setStatus(reply.midiNotes.length ? "오디오 분석을 코드 추천에 반영했어요." : "분석할 음을 찾지 못했어요.");
    } catch (cause) {
      setAnalysisError(errorText(cause));
    } finally {
      activeAnalysis.current = false;
      setAnalysisBusy(false);
    }
  }
  async function addAudio(trackId: number, file: File, selection: AudioSelection) {
    if (!composition || busy) throw new Error("잠시 후 다시 시도해 주세요.");
    setBusy(true);
    setError(null);
    try {
      const { wav, durationMs } = await prepareAudioFile(file, selection);
      if (durationMs > composition.project.maxDurationMs)
        throw new Error("오디오는 1분 이하여야 합니다.");
      const { bpm, ppq, maxTick, projectId: id } = composition.project;
      const durationTick = Math.max(
        1,
        Math.min(maxTick, Math.ceil((durationMs * bpm * ppq) / 60_000)),
      );
      await createAudioClip(id, trackId, await uploadMedia(wav, "AUDIO"), durationTick);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitDrafts(comment: string) {
    if (!composition || busy || !comment.trim()) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const id = composition.project.projectId;
      const drafts = await syncProjectEditorDrafts(
        id,
        composition.viewerPermission.userId,
        browserDraftStorage(),
      );
      const submitted = await submitEditorDrafts(
        id,
        drafts,
        composition.project.version,
        comment.trim(),
      );
      clearCommittedRecovery(browserDraftStorage(), drafts);
      // Drafts, tracks and contribution lists of this account all changed with the submission.
      void queryClient.invalidateQueries({ queryKey: compositionKeys.all(userId) });
      setStatus(`제출 #${submitted.contributionId} · ${submitted.approvalStatus}`);
      setShowSubmitForm(false);
      onSubmitted();
    } catch (cause) {
      setError(errorText(cause));
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          await refresh();
        } catch {
          /* Keep the original conflict visible and all local recovery intact. */
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const canSavePrivate =
    composition !== null &&
    shortId === null &&
    !composition.project.isPublic &&
    composition.project.ownerId === composition.viewerPermission.userId &&
    composition.viewerPermission.canEdit;

  async function commitProjectEdits() {
    if (!composition) return;
    const id = composition.project.projectId;
    const storage = browserDraftStorage();
    const drafts = await syncProjectEditorDrafts(id, composition.viewerPermission.userId, storage);
    if (drafts.length) clearCommittedRecovery(storage, await commitEditorDrafts(id, drafts));
  }

  async function savePrivateDraft(title?: string) {
    if (!composition || busy || !canSavePrivate) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await commitProjectEdits();
      if (title) {
        const imageId = publishImage ? await uploadMedia(publishImage, "IMAGE") : null;
        await updateProjectMetadata(composition.project.projectId, title, imageId);
      }
      setMetadataAction(null);
      setStatus("비공개로 저장했습니다. 작업 중인 음악에서 이어서 편집할 수 있습니다.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      void queryClient.invalidateQueries({ queryKey: compositionKeys.all(userId) });
      setBusy(false);
    }
  }

  async function publish() {
    if (!composition || busy) return;
    setBusy(true);
    setError(null);
    setStatus("숏폼 음원을 생성하는 중입니다.");
    try {
      const id = composition.project.projectId;
      await commitProjectEdits();
      if (composition.viewerPermission.canReviewContribution) {
        const latest = await queryClient.fetchQuery({
          ...compositionQuery(userId, id),
          staleTime: 0,
        });
        const viewerId = latest.viewerPermission.userId;
        const hasUnsubmitted = latest.tracks.some(
          (track) =>
            track.ownerId === viewerId &&
            (track.approvalStatus === "DRAFT" ||
              track.clips.some(
                (clip) => clip.ownerId === viewerId && clip.approvalStatus === "DRAFT",
              )),
        );
        if (hasUnsubmitted)
          await submitEditorDrafts(id, [], latest.project.version, "원작성자 변경 반영");
        for (const pending of (await getPendingContributions(id)).filter(
          (item) => item.userId === viewerId,
        )) {
          await reviewContribution(id, pending.contributionId, "APPROVED");
        }
        await refresh();
        if (latest.project.isPublic) {
          setStatus("내 변경을 승인했습니다. 갱신된 음원이 곧 숏폼에 반영됩니다.");
          return;
        }
      }
      const { exportId } = await publishComposition(id);
      for (let attempt = 0; attempt < 30; attempt++) {
        const { promise, resolve } = Promise.withResolvers<void>();
        window.setTimeout(resolve, 1000);
        await promise;
        const result = await getExport(id, exportId);
        const publishedShortId = completedExportShortId(result);
        if (publishedShortId !== null) {
          onReturnToShort(publishedShortId);
          return;
        }
        if (result.status === "FAILED")
          throw new Error(result.errorMessage ?? "음원 생성에 실패했습니다.");
      }
      setStatus("음원 생성이 계속 진행 중입니다. 잠시 후 숏폼에서 확인해 주세요.");
    } catch (cause) {
      setError(errorText(cause));
      setStatus(null);
    } finally {
      // Commits, approvals and exports may have landed even when a later step failed; a finished export is also a new
      // or updated short in the song lists and the abyss feed.
      void queryClient.invalidateQueries({ queryKey: compositionKeys.all(userId) });
      void queryClient.invalidateQueries({ queryKey: [...queryScope(userId), "songs"] });
      void queryClient.invalidateQueries({ queryKey: [...queryScope(userId), "shorts"] });
      setBusy(false);
    }
  }

  function requestPublish() {
    if (!composition || busy) return;
    setError(null);
    setStatus(null);
    if (composition.project.title === "제목 없는 곡") {
      setPublishTitle("");
      setPublishImage(null);
      setMetadataAction("publish");
    } else setShowPublishConfirmation(true);
  }

  async function finishMetadata(title: string) {
    if (!composition || !metadataAction || !title.trim() || busy) return;
    if (metadataAction === "save") {
      await savePrivateDraft(title.trim());
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const imageId = publishImage ? await uploadMedia(publishImage, "IMAGE") : null;
      await updateProjectMetadata(composition.project.projectId, title.trim(), imageId);
      await refresh();
      setMetadataAction(null);
      setShowPublishConfirmation(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const ready = composition !== null && composition.viewerPermission.userId === userId;
  const tracks = preview?.tracks ?? composition?.tracks ?? [];

  /** Saves a clip's new start as the viewer's draft of it; the timeline then shows the draft. */
  async function moveClip(track: TrackDto, clip: ClipDto, startTick: number) {
    if (!composition) return;
    const { project, viewerPermission } = composition;
    if (overlapsClip(clip, startTick, track.clips))
      throw new Error("같은 레이어의 다른 클립과 겹칠 수 없습니다.");
    playback.pause();
    setBusy(true);
    setError(null);
    try {
      const shared = composition.tracks
        .find((item) => item.trackId === track.trackId)
        ?.clips.find((item) => item.clipId === clip.clipId);
      if (!shared) throw new Error("새 개인 초안은 피아노롤에서 편집해주세요.");
      const context = {
        origin: apiOrigin(),
        userId: viewerPermission.userId,
        projectId: project.projectId,
        trackId: track.trackId,
        targetClipId: clip.clipId,
      };
      const baseClip = {
        startTick: shared.startTick,
        durationTick: shared.durationTick,
        midiNotes: shared.midiNotes ?? [],
      };
      const local = readLocalDraft(browserDraftStorage(), context);
      const server = personalDrafts?.find(
        (item) => item.trackId === track.trackId && item.targetClipId === clip.clipId,
      );
      const session = new DraftSession({
        context,
        content: baseClip,
        baseClip,
        local,
        server,
        storage: browserDraftStorage(),
        save: (request, id) => saveEditorDraft(project.projectId, track.trackId, id, request),
      });
      try {
        session.edit({ ...session.getSnapshot().content, startTick });
        await session.flush();
      } finally {
        session.dispose();
      }
      await queryClient.invalidateQueries(
        { queryKey: compositionKeys.drafts(userId, project.projectId) },
        { throwOnError: true },
      );
      rememberWork(
        await queryClient.fetchQuery({
          ...compositionQuery(userId, project.projectId),
          staleTime: 0,
        }),
        shortId,
      );
    } finally {
      setBusy(false);
    }
  }

  const viewerPermission = composition?.viewerPermission;
  const project = composition?.project;
  const canSubmit =
    viewerPermission !== undefined &&
    shouldShowContributionSubmit(shortId, viewerPermission, tracks);
  const canPublish =
    viewerPermission !== undefined && shouldOfferSongPublish(shortId, viewerPermission, tracks);
  const layerCreationAllowed =
    viewerPermission !== undefined && canCreateLayer(viewerPermission, tracks, shortId === null);
  const trackEditorTarget = (track: TrackDto) =>
    viewerPermission && project && (selectMidiLayer || track.clips.length === 0)
      ? layerEditorTarget(viewerPermission, project.status, track)
      : null;
  const resumableLayer =
    viewerPermission && project
      ? tracks
          .map((track) => emptyLayerEditor(viewerPermission, project.status, track))
          .find(Boolean)
      : null;
  const primary: StudioPrimary = canSubmit
    ? { kind: "submit", disabled: busy }
    : {
        kind: canPublish ? "publish" : "add",
        disabled:
          busy ||
          (!(shortId == null && viewerPermission?.canExport) &&
            !layerCreationAllowed &&
            !resumableLayer),
        hint:
          !layerCreationAllowed && !resumableLayer && viewerPermission?.canContribute
            ? "한 곡에는 하나의 레이어만 만들 수 있습니다."
            : null,
      };

  const onTiming =
    project &&
    viewerPermission &&
    viewerPermission.canEdit &&
    project.ownerId === viewerPermission.userId &&
    ["DRAFT", "IN_PROGRESS"].includes(project.status)
      ? async ({ bpm, signature }: ProjectTiming) => {
          playback.pause();
          await updateProjectTiming(project.projectId, {
            bpm,
            timeSignatureNumerator: signature.numerator,
            timeSignatureDenominator: signature.denominator,
          });
          await refresh();
        }
      : undefined;

  const contribution =
    contributionId == null
      ? null
      : requestList.isPending
        ? { text: "요청의 추가 트랙을 확인하는 중...", retry: false }
        : requestList.isError
          ? { text: "요청의 추가 트랙을 확인하지 못했습니다.", retry: true }
          : !highlightedRequest
            ? { text: "이 요청의 추가 트랙을 확인할 수 없습니다.", retry: false }
            : highlightedTracks.size
              ? {
                  text: `이 요청으로 추가한 트랙 ${highlightedTracks.size}개를 강조했어요.`,
                  retry: false,
                }
              : { text: "요청의 추가 트랙이 현재 음악에 없습니다.", retry: false };

  const settingsTrack = tracks.find((track) => track.trackId === trackSettingsId) ?? null;
  const trackSettings =
    settingsTrack && viewerPermission && project
      ? {
          track: settingsTrack,
          volume: playback.trackVolumes[settingsTrack.trackId] ?? settingsTrack.volume,
          roleEditable:
            viewerPermission.canEdit &&
            settingsTrack.ownerId === viewerPermission.userId &&
            ["DRAFT", "IN_PROGRESS"].includes(project.status) &&
            ["DRAFT", "APPROVED"].includes(settingsTrack.approvalStatus),
        }
      : null;

  const instrumentTrack = tracks.find((track) => track.trackId === instrumentTrackId);
  // Personal MIDI drafts are already merged into `tracks`, so they also force MIDI mode.
  const instrumentMidi = instrumentTrack?.clips.some((clip) => clip.clipType === "MIDI") ?? false;
  const instrumentChoice: InstrumentChoice | null =
    instrumentTrack && composition
      ? {
          value: instrumentTrack.instrument,
          mode: instrumentMidi ? "midi" : "audio",
          tracks: composition.tracks,
          currentTrackId: instrumentTrack.trackId,
          onPreview: instrumentMidi
            ? playback.previewInstrument
            : () =>
                previewOriginal(
                  instrumentTrack.clips.find((clip) => clip.clipType === "AUDIO" && clip.mediaUrl),
                ),
          onStopPreview: playback.stopPreview,
          onConfirm: async (instrument) => {
            if (instrumentMidi) {
              const definition = findInstrument(instrument);
              const pitches = instrumentTrack.clips.flatMap((clip) =>
                (clip.midiNotes ?? []).map((note) => note.pitch),
              );
              if (!definition || invalidPitchesFor(definition, pitches).length)
                throw new Error("현재 노트에 이 악기에서 지원하지 않는 음이 있습니다.");
            }
            playback.pause();
            await updateTrackInstrument(
              composition.project.projectId,
              instrumentTrack.trackId,
              instrument,
            );
            // Only metadata/occupancy is re-read; personal drafts and their history stay as they are.
            await queryClient.invalidateQueries(
              { queryKey: compositionKeys.detail(userId, composition.project.projectId) },
              { throwOnError: true },
            );
          },
        }
      : null;

  return {
    userId,
    composition,
    ready,
    loadMessage: loadFailure ? errorText(loadFailure) : error,
    tracks,
    playback,
    busy,
    error,
    setError,
    status: status ?? (readOnly && contributionId == null ? "승인된 레이어만 표시합니다." : null),
    selectMidiLayer,
    highlightedTracks,
    contribution,
    retryContribution: () => void requestList.refetch(),
    primary,
    canImportSource: layerCreationAllowed,
    onTiming,
    onExit,
    onAddLayer: () => (resumableLayer ? onEditTrack(resumableLayer.trackId, null) : onAddLayer()),
    onEditTrack,
    showSources,
    setShowSources,
    importResource: async (resource: Resource) => {
      await onImportResource(resource);
      await refresh();
      setShowSources(false);
    },
    showSubmitForm,
    setShowSubmitForm,
    submitDrafts,
    showPublishConfirmation,
    setShowPublishConfirmation,
    metadataAction,
    closeMetadata: () => {
      if (!busy) setMetadataAction(null);
    },
    canSavePrivate,
    savePrivateDisabled: busy || !tracks.some((track) => track.clips.length),
    requestPrivateSave: () => {
      if (!canSavePrivate || busy || !tracks.some((track) => track.clips.length)) return;
      if (project?.title === "제목 없는 곡") {
        setError(null);
        setStatus(null);
        setPublishTitle("");
        setPublishImage(null);
        setMetadataAction("save");
      } else void savePrivateDraft();
    },
    publishTitle,
    setPublishTitle,
    publishImage,
    setPublishImage,
    requestPublish,
    publish,
    finishMetadata,
    pendingAudio,
    setPendingAudio,
    addAudio,
    canAnalyze,
    openAnalysis,
    analyze,
    analysisClip,
    analysisBusy,
    analysisError,
    closeAnalysis: () => { if (!activeAnalysis.current) setAnalysisClip(null); },
    trackSettings,
    setTrackSettingsId,
    changeInstrument: (trackId: number) => {
      playback.pause();
      setTrackSettingsId(null);
      setInstrumentTrackId(trackId);
    },
    instrumentChoice,
    closeInstrument: () => setInstrumentTrackId(null),
    trackEditorTarget,
    openTrack: (track: TrackDto) => {
      const target = trackEditorTarget(track);
      if (target) onEditTrack(target.trackId, target.clipId);
      else setTrackSettingsId(track.trackId);
    },
    clipMovable: (clip: ClipDto) =>
      !busy &&
      clip.clipId > 0 &&
      viewerPermission !== undefined &&
      canMoveClip(viewerPermission, clip) &&
      clip.clipType === "MIDI",
    moveClip,
  };
}

export type Studio = ReturnType<typeof useStudio>;

export function StudioScreen({ studio, portrait = true }: { studio: Studio; portrait?: boolean }) {
  const {
    composition,
    playback,
    busy,
    error,
    setError,
    tracks,
    highlightedTracks,
    selectMidiLayer,
    onEditTrack,
  } = studio;
  const [submitComment, setSubmitComment] = useState("");
  const firstHighlightedTrack = useRef<HTMLDivElement>(null);
  const highlightKey = [...highlightedTracks].join(":");
  useEffect(() => {
    if (highlightKey)
      firstHighlightedTrack.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [highlightKey]);

  if (!composition || !studio.ready) {
    const message = studio.loadMessage;
    return (
      <div
        className={cn(studioStyles.studio, studioStyles.studioState, portrait && studioStyles.studioUpright)}
        role={message ? "alert" : "status"}
      >
        <p>{message ?? "작곡 데이터를 불러오는 중입니다."}</p>
        {message && <button onClick={studio.onExit}>돌아가기</button>}
      </div>
    );
  }
  const { project, viewerPermission } = composition;
  const timelineWidth = (project.maxTick / Math.max(1, project.ppq / 2)) * 20;
  const { primary, trackSettings, pendingAudio } = studio;
  return (
    <div className={cn(studioStyles.studio, portrait && studioStyles.studioUpright)}>
      <StudioToolbar
        signature={playback.signature}
        onTiming={studio.onTiming}
        title={project.title}
        bpm={project.bpm}
        playing={playback.playing}
        positionMs={playback.positionMs}
        onPlay={() => {
          void playback.play();
        }}
        onPause={playback.pause}
        volume={playback.volume}
        onVolume={playback.setVolume}
        metronome={playback.metronome}
        onMetronome={() => playback.setMetronome((value) => !value)}
        onImportSource={
          studio.canImportSource
            ? () => {
                playback.pause();
                studio.setShowSources(true);
              }
            : undefined
        }
        onBack={studio.onExit}
      >
        {studio.canSavePrivate && (
          <button
            className={studioStyles.studioSubmit}
            disabled={studio.savePrivateDisabled}
            onClick={studio.requestPrivateSave}
          >
            임시 저장
          </button>
        )}
        {primary.kind === "submit" ? (
          <button
            className={studioStyles.studioSubmit}
            onClick={() => {
              setError(null);
              studio.setShowSubmitForm(true);
            }}
            disabled={primary.disabled}
          >
            제출하기
          </button>
        ) : primary.kind === "publish" ? (
          <button
            className={studioStyles.studioSubmit}
            disabled={primary.disabled}
            onClick={studio.requestPublish}
          >
            공개하기
          </button>
        ) : (
          <button
            className={studioStyles.studioAdd}
            onClick={studio.onAddLayer}
            disabled={primary.disabled}
            aria-label="레이어 추가"
            title={primary.hint ?? undefined}
          >
            <i />
          </button>
        )}
      </StudioToolbar>
      {selectMidiLayer && (
        <p className="m-0 shrink-0 px-4 py-2 text-caption text-app-muted">
          피아노롤에서 열 MIDI 레이어를 선택하세요.
        </p>
      )}
      {studio.contribution && (
        <div
          className="flex shrink-0 items-center gap-2 px-4 py-2 text-caption text-app-primary-soft"
          role="status"
        >
          {studio.contribution.retry ? (
            <>
              <span>{studio.contribution.text}</span>
              <button onClick={studio.retryContribution}>다시 시도</button>
            </>
          ) : (
            studio.contribution.text
          )}
        </div>
      )}
      {(error || playback.error) && !studio.showSubmitForm && !studio.metadataAction && (
        <p className={studioStyles.studioError} role="alert">
          {error ?? playback.error}
        </p>
      )}
      {studio.status && (
        <div className={studioStyles.studioWorkflow}>
          {studio.status && <span role="status">{studio.status}</span>}
        </div>
      )}
      {studio.showSubmitForm && (
        <form
          className={cn(studioStyles.studioPublishForm, "studio-submit-form")}
          onSubmit={(event) => {
            event.preventDefault();
            void studio.submitDrafts(submitComment);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-heading"
        >
          <h2 id="submit-heading">작업 제출</h2>
          <p>추가한 레이어를 원곡자에게 보냅니다. 승인되면 숏폼에 반영됩니다.</p>
          <label>
            한 줄 코멘트
            <input
              value={submitComment}
              onChange={(event) => setSubmitComment(event.target.value)}
              maxLength={120}
              required
              placeholder="어떤 작업을 추가했나요?"
              autoFocus
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div>
            <button
              type="button"
              onClick={() => {
                studio.setShowSubmitForm(false);
                setError(null);
              }}
              disabled={busy}
            >
              취소
            </button>
            <button type="submit" disabled={busy || !submitComment.trim()}>
              {busy ? "제출 중..." : "제출하기"}
            </button>
          </div>
        </form>
      )}
      {studio.showPublishConfirmation && (
        <PublishConfirmation
          onClose={() => studio.setShowPublishConfirmation(false)}
          onConfirm={() => {
            studio.setShowPublishConfirmation(false);
            void studio.publish();
          }}
        />
      )}
      {studio.metadataAction && (
        <form
          className={studioStyles.studioPublishForm}
          onSubmit={(event) => {
            event.preventDefault();
            void studio.finishMetadata(studio.publishTitle);
          }}
        >
          <h2>{studio.metadataAction === "save" ? "곡 임시 저장" : "곡 공개 정보"}</h2>
          <p>곡 제목을 등록하세요. 앨범 이미지는 선택사항입니다.</p>
          <label>
            곡 제목
            <input
              value={studio.publishTitle}
              onChange={(event) => studio.setPublishTitle(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label>
            앨범 이미지 (선택)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => studio.setPublishImage(event.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div>
            <button type="button" disabled={studio.busy} onClick={studio.closeMetadata}>
              취소
            </button>
            <button disabled={studio.busy} type="submit">
              {studio.busy
                ? "저장 중..."
                : studio.metadataAction === "save"
                  ? "비공개로 저장"
                  : "다음"}
            </button>
          </div>
        </form>
      )}
      {pendingAudio && (
        <div
          className={studioStyles.studioAudioDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="audio-trim-heading"
        >
          <div className={studioStyles.studioAudioDialogContent}>
            <h2 id="audio-trim-heading">파일 구간 선택</h2>
            <p>{pendingAudio.file.name}</p>
            <AudioTrimPicker
              url={pendingAudio.url}
              saveLabel="선택 구간을 레이어에 저장"
              onCancel={() => studio.setPendingAudio(null)}
              onSave={async (selection) => {
                await studio.addAudio(pendingAudio.trackId, pendingAudio.file, selection);
                studio.setPendingAudio(null);
              }}
            />
          </div>
        </div>
      )}
      {studio.analysisClip && (
        <AudioAnalysisDialog key={studio.analysisClip.clipId} studio={studio} />
      )}
      {trackSettings && (
        <VolumeDialog
          track={trackSettings.track}
          value={trackSettings.volume}
          onChange={(value) => playback.setTrackVolume(trackSettings.track.trackId, value)}
          onClose={() => studio.setTrackSettingsId(null)}
          onChangeInstrument={
            trackSettings.roleEditable
              ? () => studio.changeInstrument(trackSettings.track.trackId)
              : undefined
          }
        />
      )}
      {studio.instrumentChoice && (
        <InstrumentDialog choice={studio.instrumentChoice} onClose={studio.closeInstrument} />
      )}
      {studio.showSources && (
        <StudioSourceDialog
          onClose={() => studio.setShowSources(false)}
          onResource={studio.importResource}
        />
      )}
      <div
        className={studioStyles.timeline}
        style={{ "--timeline-lanes": tracks.length } as CSSProperties}
      >
        <div className={studioStyles.timelineContent} style={{ minWidth: 98 + timelineWidth }}>
          <div
            className={studioStyles.ruler}
            style={{ width: timelineWidth }}
            role="slider"
            tabIndex={0}
            aria-label="타임라인 재생 위치"
            aria-valuemin={0}
            aria-valuemax={project.maxDurationMs}
            aria-valuenow={Math.round(playback.positionMs)}
            onPointerDown={(event) => {
              const bounds = logicalBounds(event.currentTarget);
              playback.seek(
                Math.max(
                  0,
                  Math.min(
                    project.maxDurationMs,
                    ((pointerAxes(event.currentTarget, event).x - bounds.left) / bounds.width) *
                      project.maxDurationMs,
                  ),
                ),
              );
            }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              playback.seek(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? project.maxDurationMs
                    : Math.max(
                        0,
                        Math.min(
                          project.maxDurationMs,
                          playback.positionMs +
                            ((event.key === "ArrowRight" ? 1 : -1) * 30000) / project.bpm,
                        ),
                      ),
              );
            }}
          >
            <MusicalRuler signature={playback.signature} width={timelineWidth} />
          </div>
          <div className={studioStyles.timelineSidebarFill} aria-hidden="true" />
          <div
            className={studioStyles.studioPlayhead}
            hidden={!playback.playing && playback.positionMs === 0}
            style={{
              left: `${98 + (playback.positionMs / project.maxDurationMs) * timelineWidth}px`,
            }}
          />
          <div
            className={studioStyles.timelineGridFill}
            aria-hidden="true"
            style={{
              width: timelineWidth,
              backgroundImage: `repeating-linear-gradient(to bottom,transparent 0 42px,var(--black) 42px 46px),${musicalGridBackground(playback.signature)},repeating-linear-gradient(to bottom,var(--grid-cell) 0 1px,var(--grid-row) 1px 41px,var(--grid-cell) 41px 42px,var(--black) 42px 46px,var(--grid-cell) 46px 47px,var(--grid-row-alt) 47px 87px,var(--grid-cell) 87px 88px,var(--black) 88px 92px)`,
            }}
          />
          {tracks.map((track) => (
            <div
              className={cn(
                sharedStyles.track,
                studioStyles.studioTrack,
                highlightedTracks.has(track.trackId) &&
                  "after:pointer-events-none after:absolute after:inset-0 after:z-[3] after:rounded-md after:border-2 after:border-solid after:border-app-primary-soft after:content-['']",
              )}
              key={track.trackId}
              ref={track.trackId === [...highlightedTracks][0] ? firstHighlightedTrack : undefined}
              data-contribution-highlighted={highlightedTracks.has(track.trackId) || undefined}
              aria-label={
                highlightedTracks.has(track.trackId)
                  ? `${track.name} · 이 요청으로 추가된 트랙`
                  : undefined
              }
            >
              <div className={studioStyles.trackPerson} title={track.name}>
                {highlightedTracks.has(track.trackId) && (
                  <span className="pointer-events-none absolute right-1 bottom-0 z-[3] rounded bg-app-primary px-1 text-[9px] leading-3 text-white">
                    추가 트랙
                  </span>
                )}
                <button
                  className={"track-settings-trigger"}
                  aria-label={
                    studio.trackEditorTarget(track)
                      ? `${track.name} 피아노롤 열기`
                      : `${track.name} 트랙 설정`
                  }
                  onClick={() => studio.openTrack(track)}
                >
                  <Avatar src={track.ownerProfileImageUrl} />
                </button>
                <button
                  aria-label={`${track.name} ${playback.mutedTrackIds.has(track.trackId) ? "소리 켜기" : "음소거"}`}
                  aria-pressed={playback.mutedTrackIds.has(track.trackId)}
                  onClick={() => playback.toggleTrackMute(track.trackId)}
                >
                  <Asset
                    name={
                      playback.mutedTrackIds.has(track.trackId) ? "sound-muted.svg" : "sound.svg"
                    }
                  />
                </button>
              </div>
              <div
                className={studioStyles.studioTrackClips}
                style={{ width: timelineWidth, flexBasis: timelineWidth }}
              >
                {emptyLayerEditor(viewerPermission, project.status, track) && (
                  <button
                    type="button"
                    className="absolute inset-y-1 left-1 rounded-md border border-dashed border-app-primary-soft px-4 text-caption text-app-primary-soft"
                    onClick={() => onEditTrack(track.trackId, null)}
                  >
                    + 노트 · 이어서 편집
                  </button>
                )}
                {track.clips.map((clip) => (
                  <TimelineClip
                    key={clip.clipId}
                    clip={clip}
                    name={track.name}
                    instrument={track.instrument}
                    maxTick={project.maxTick}
                    stepTick={(project.ppq * 2) / playback.signature.denominator}
                    cellPx={signatureGrid(playback.signature).cellPx}
                    movable={studio.clipMovable(clip)}
                    onError={setError}
                    onSelect={() => studio.canAnalyze(clip)
                      ? studio.openAnalysis(clip) : studio.setTrackSettingsId(track.trackId)}
                    onEdit={
                      // Other participants' MIDI opens read-only; the editor never creates their drafts.
                      clip.clipType === "MIDI"
                        ? () => onEditTrack(track.trackId, clip.clipId > 0 ? clip.clipId : null)
                        : undefined
                    }
                    onMove={(startTick) => studio.moveClip(track, clip, startTick)}
                  />
                ))}
              </div>
              {track.ownerId === viewerPermission.userId && (
                <div className={studioStyles.studioTrackActions}>
                  {track.instrument && (
                    <button onClick={() => onEditTrack(track.trackId, null)}>+ 노트</button>
                  )}
                  <label className={studioStyles.studioUpload}>
                    + 파일
                    <input
                      type="file"
                      accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
                      disabled={busy || !viewerPermission.canContribute}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          studio.setPendingAudio({
                            trackId: track.trackId,
                            file,
                            url: URL.createObjectURL(file),
                          });
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudioAnalysisDialog({ studio }: { studio: Studio }) {
  const cached = studio.analysisClip?.audioAnalysis;
  const [kind, setKind] = useState<AudioSoundKind | null>(cached?.soundKind ?? null);
  const busy = studio.analysisBusy;
  return (
    <CanvasDialog className={studioStyles.studioAudioDialogContent}
      titleId="audio-analysis-title" onClose={studio.closeAnalysis}>
      <h2 id="audio-analysis-title">코드 추천에 사용할 오디오 분석</h2>
      <p>소리 종류를 선택하면 원본 오디오에서 추천에 사용할 음을 찾습니다.</p>
      {cached && <p>저장된 분석 · {cached.midiNotes.length}음</p>}
      <fieldset className="space-y-2" disabled={busy}>
        <legend>입력 소리 종류</legend>
        <label className="flex gap-2">
          <input type="radio" name="sound-kind" checked={kind === "HUMMING"}
            onChange={() => setKind("HUMMING")} /> 허밍 · 단선율 보컬
        </label>
        <label className="flex gap-2">
          <input type="radio" name="sound-kind" checked={kind === "INSTRUMENT"}
            onChange={() => setKind("INSTRUMENT")} /> 피아노 · 기타 등 악기
        </label>
      </fieldset>
      {studio.analysisError && <p role="alert">{studio.analysisError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !kind}
          onClick={() => kind && void studio.analyze(kind, cached?.soundKind === kind)}>
          {busy ? "분석 중…" : cached ? "다시 분석" : "음 분석 시작"}
        </button>
        <button type="button" disabled={busy} onClick={studio.closeAnalysis}>닫기</button>
      </div>
    </CanvasDialog>
  );
}

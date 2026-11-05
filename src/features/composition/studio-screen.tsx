import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PublishConfirmation } from "@/features/composition/publish-confirmation";
import { VolumeDialog } from "@/features/composition/volume-dialog";
import { InstrumentDialog } from "@/features/composition/instrument-dialog";
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
import {
  createAudioClip,
  enterComposition,
  getComposition,
  getExport,
  getPendingContributions,
  publishComposition,
  reviewContribution,
  updateProjectMetadata,
  updateTrackInstrument,
  uploadMedia,
  type ClipDto,
  type CompositionDto,
} from "@/lib/api/composition";
import { errorText } from "./studio-helpers";
import { StudioToolbar } from "./studio-toolbar";
import { ApiError, apiOrigin } from "@/lib/api/client";
import {
  getEditorDrafts,
  commitEditorDrafts,
  submitEditorDrafts,
  saveEditorDraft,
} from "@/lib/api/composition-drafts";
import { updateProjectTiming } from "@/lib/api/composition";
import { syncProjectEditorDrafts, clearCommittedRecovery } from "./project-editor-drafts";
import { browserDraftStorage } from "./use-editor-draft";
import { listLocalDrafts, readLocalDraft, DraftSession, type ServerDraft } from "./editor-draft";
import { withPersonalDrafts } from "./draft-preview";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export function StudioScreen({
  onSubmitted,
  shortId,
  projectId,
  onReturnToShort,
  onProjectSelected,
  onAddLayer,
  onEditTrack,
  onImportResource,
  onExit,
}: {
  onSubmitted: () => void;
  shortId: number | null;
  projectId: number | null;
  onExit: () => void;
  onReturnToShort: (shortId: number) => void;
  onProjectSelected: (id: number) => void;
  onImportResource: (resource: Resource) => Promise<void>;
  onAddLayer: () => void;
  onEditTrack: (trackId: number, clipId: number | null) => void;
}) {
  const userId = useCurrentUserId();
  const origin = apiOrigin();
  const [showSources, setShowSources] = useState(false);
  const [trackSettingsId, setTrackSettingsId] = useState<number | null>(null);
  const [instrumentTrackId, setInstrumentTrackId] = useState<number | null>(null);
  // Original audio of a layer, fetched once per media URL for the role chooser's audition.
  const originalAudio = useRef(new Map<string, Promise<File>>());
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [compositionOrigin, setCompositionOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitComment, setSubmitComment] = useState("");
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishImage, setPublishImage] = useState<File | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{
    trackId: number;
    file: File;
    url: string;
  } | null>(null);
  const [personalDrafts, setPersonalDrafts] = useState<ServerDraft[]>([]);
  const preview = useMemo(() => {
    if (!composition || composition.viewerPermission.userId !== userId || compositionOrigin !== origin) return null;
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
  }, [composition, personalDrafts, userId, origin, compositionOrigin]);
  const playback = useCompositionPlayback(preview, {
    scopeKey: JSON.stringify([origin, userId, projectId ?? composition?.project.projectId ?? null]),
  });

  useEffect(
    () => () => {
      if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
    },
    [pendingAudio],
  );

  // A different route/account/backend starts from an empty screen before its own response arrives.
  const loadKey = JSON.stringify([shortId, projectId, userId, origin]);
  const [loadedKey, setLoadedKey] = useState(loadKey);
  if (loadedKey !== loadKey) {
    setLoadedKey(loadKey);
    setComposition(null);
    setPersonalDrafts([]);
    setTrackSettingsId(null);
    setInstrumentTrackId(null);
    setError(null);
  }
  useEffect(() => {
    if (shortId == null && projectId == null) return;
    let cancelled = false;
    originalAudio.current.clear();
    (async () => {
      const id = shortId == null ? projectId! : (await enterComposition(shortId)).projectId;
      const [result, drafts] = await Promise.all([getComposition(id), getEditorDrafts(id)]);
      if (!cancelled) {
        setComposition(result);
        setCompositionOrigin(origin);
        setPersonalDrafts(drafts);
        try {
          rememberWork(result, shortId);
        } catch {
          /* The server project remains available if browser storage is full. */
        }
        if (id !== projectId) onProjectSelected(id);
      }
    })().catch((cause) => {
      if (!cancelled) setError(errorText(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [shortId, projectId, onProjectSelected, userId, origin]);

  /** Plays the layer's own trimmed server audio; the media is fetched once per URL in this scope. */
  async function previewOriginal(clip: ClipDto | undefined) {
    if (!clip?.mediaUrl) throw new Error("미리 들을 원본 오디오가 없습니다.");
    const url = clip.mediaUrl;
    let file = originalAudio.current.get(url);
    if (!file) {
      file = fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`원본 오디오를 불러오지 못했습니다. (${response.status})`);
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

  async function refresh() {
    if (composition) {
      const id = composition.project.projectId;
      const [latest, drafts] = await Promise.all([getComposition(id), getEditorDrafts(id)]);
      setComposition(latest);
      setPersonalDrafts(drafts);
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

  async function submitDrafts(event: React.FormEvent) {
    event.preventDefault();
    if (!composition || busy || !submitComment.trim()) return;
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
        submitComment.trim(),
      );
      clearCommittedRecovery(browserDraftStorage(), drafts);
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

  async function publish(afterMetadataSave = false) {
    if (!composition || (busy && !afterMetadataSave)) return;
    setBusy(true);
    setError(null);
    setStatus("숏폼 음원을 생성하는 중입니다.");
    try {
      const id = composition.project.projectId;
      const drafts = await syncProjectEditorDrafts(
        id,
        composition.viewerPermission.userId,
        browserDraftStorage(),
      );
      const committed = await commitEditorDrafts(id, drafts);
      clearCommittedRecovery(browserDraftStorage(), committed);
      if (composition.viewerPermission.canReviewContribution) {
        const latest = await getComposition(id);
        const userId = latest.viewerPermission.userId;
        const hasUnsubmitted = latest.tracks.some(
          (track) =>
            track.ownerId === userId &&
            (track.approvalStatus === "DRAFT" ||
              track.clips.some(
                (clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT",
              )),
        );
        if (hasUnsubmitted)
          await submitEditorDrafts(id, [], latest.project.version, "원작성자 변경 반영");
        for (const pending of (await getPendingContributions(id)).filter(
          (item) => item.userId === userId,
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
      setBusy(false);
    }
  }

  function requestPublish() {
    if (!composition) return;
    if (!composition.tracks.some((track) => track.clips.length)) {
      setError("먼저 피아노롤 노트나 오디오 파일을 레이어에 저장해 주세요.");
      return;
    }
    if (composition.project.title === "제목 없는 곡") {
      setPublishTitle("");
      setShowPublishForm(true);
    } else setShowPublishConfirmation(true);
  }

  async function finishMetadata(event: React.FormEvent) {
    event.preventDefault();
    if (!composition || !publishTitle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const imageId = publishImage ? await uploadMedia(publishImage, "IMAGE") : null;
      await updateProjectMetadata(composition.project.projectId, publishTitle.trim(), imageId);
      await refresh();
      setShowPublishForm(false);
      setShowPublishConfirmation(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!composition || composition.viewerPermission.userId !== userId || compositionOrigin !== origin)
    return (
      <div
        className={cn(studioStyles.studio, studioStyles.studioState)}
        role={error ? "alert" : "status"}
      >
        <p>{error ?? "작곡 데이터를 불러오는 중입니다."}</p>
        {error && <button onClick={onExit}>돌아가기</button>}
      </div>
    );
  const { project, viewerPermission } = composition;
  const tracks = preview?.tracks ?? composition.tracks;
  const timelineWidth = (project.maxTick / Math.max(1, project.ppq / 2)) * 20;
  const canSubmit = shouldShowContributionSubmit(shortId, viewerPermission, tracks);
  const canPublish = shouldOfferSongPublish(shortId, viewerPermission, tracks);
  const layerCreationAllowed = canCreateLayer(viewerPermission, tracks, shortId === null);
  return (
    <div className={studioStyles.studio}>
      <StudioToolbar
        signature={playback.signature}
        onTiming={
          project.ownerId === viewerPermission.userId &&
          ["DRAFT", "IN_PROGRESS"].includes(project.status)
            ? async ({ bpm, signature }) => {
                playback.pause();
                await updateProjectTiming(project.projectId, {
                  bpm,
                  timeSignatureNumerator: signature.numerator,
                  timeSignatureDenominator: signature.denominator,
                });
                await refresh();
              }
            : undefined
        }
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
          layerCreationAllowed
            ? () => {
                playback.pause();
                setShowSources(true);
              }
            : undefined
        }
        onBack={onExit}
      >
        {canSubmit ? (
          <button
            className={studioStyles.studioSubmit}
            onClick={() => {
              setError(null);
              setShowSubmitForm(true);
            }}
            disabled={busy}
          >
            제출하기
          </button>
        ) : (
          <button
            className={studioStyles.studioAdd}
            onClick={canPublish ? requestPublish : onAddLayer}
            disabled={
              busy || (!(shortId == null && viewerPermission.canExport) && !layerCreationAllowed)
            }
            aria-label={canPublish ? "곡 올리기" : "레이어 추가"}
            title={
              !layerCreationAllowed && viewerPermission.canContribute
                ? "한 곡에는 하나의 레이어만 만들 수 있습니다."
                : undefined
            }
          >
            <i />
          </button>
        )}
      </StudioToolbar>
      {(error || playback.error) && !showSubmitForm && (
        <p className={studioStyles.studioError} role="alert">
          {error ?? playback.error}
        </p>
      )}
      {status && (
        <div className={studioStyles.studioWorkflow}>
          {status && <span role="status">{status}</span>}
        </div>
      )}
      {showSubmitForm && (
        <form
          className={cn(studioStyles.studioPublishForm, "studio-submit-form")}
          onSubmit={(event) => {
            void submitDrafts(event);
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
                setShowSubmitForm(false);
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
      {showPublishConfirmation && (
        <PublishConfirmation
          onClose={() => setShowPublishConfirmation(false)}
          onConfirm={() => {
            setShowPublishConfirmation(false);
            void publish();
          }}
        />
      )}
      {showPublishForm && (
        <form className={studioStyles.studioPublishForm} onSubmit={finishMetadata}>
          <h2>곡 올리기</h2>
          <p>곡 제목을 등록하세요. 앨범 이미지는 선택사항입니다.</p>
          <label>
            곡 제목
            <input
              value={publishTitle}
              onChange={(event) => setPublishTitle(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label>
            앨범 이미지 (선택)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setPublishImage(event.target.files?.[0] ?? null)}
            />
          </label>
          <div>
            <button type="button" onClick={() => setShowPublishForm(false)}>
              취소
            </button>
            <button disabled={busy} type="submit">
              {busy ? "저장 중..." : "정보 저장"}
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
              onCancel={() => setPendingAudio(null)}
              onSave={async (selection) => {
                await addAudio(pendingAudio.trackId, pendingAudio.file, selection);
                setPendingAudio(null);
              }}
            />
          </div>
        </div>
      )}
      {trackSettingsId !== null &&
        (() => {
          const selected = tracks.find((track) => track.trackId === trackSettingsId);
          const roleEditable =
            selected?.ownerId === viewerPermission.userId &&
            ["DRAFT", "IN_PROGRESS"].includes(project.status) &&
            ["DRAFT", "APPROVED"].includes(selected.approvalStatus);
          return selected ? (
            <VolumeDialog
              track={selected}
              value={playback.trackVolumes[selected.trackId] ?? selected.volume}
              onChange={(value) => playback.setTrackVolume(selected.trackId, value)}
              onClose={() => setTrackSettingsId(null)}
              onChangeInstrument={
                roleEditable
                  ? () => {
                      playback.pause();
                      setTrackSettingsId(null);
                      setInstrumentTrackId(selected.trackId);
                    }
                  : undefined
              }
            />
          ) : null;
        })()}
      {instrumentTrackId !== null &&
        (() => {
          const selected = tracks.find((track) => track.trackId === instrumentTrackId);
          if (!selected) return null;
          // Personal MIDI drafts are already merged into `tracks`, so they also force MIDI mode.
          const midi = selected.clips.some((clip) => clip.clipType === "MIDI");
          const audioClip = selected.clips.find(
            (clip) => clip.clipType === "AUDIO" && clip.mediaUrl,
          );
          return (
            <InstrumentDialog
              choice={{
                value: selected.instrument,
                mode: midi ? "midi" : "audio",
                tracks: composition.tracks,
                currentTrackId: selected.trackId,
                onPreview: midi
                  ? playback.previewInstrument
                  : () => previewOriginal(audioClip),
                onStopPreview: playback.stopPreview,
                onConfirm: async (instrument) => {
                  if (midi) {
                    const definition = findInstrument(instrument);
                    const pitches = selected.clips.flatMap((clip) =>
                      (clip.midiNotes ?? []).map((note) => note.pitch),
                    );
                    if (!definition || invalidPitchesFor(definition, pitches).length)
                      throw new Error("현재 노트에 이 악기에서 지원하지 않는 음이 있습니다.");
                  }
                  playback.pause();
                  await updateTrackInstrument(project.projectId, selected.trackId, instrument);
                  // Only metadata/occupancy is re-read; personal drafts and their history stay as they are.
                  setComposition(await getComposition(project.projectId));
                },
              }}
              onClose={() => setInstrumentTrackId(null)}
            />
          );
        })()}
      {showSources && (
        <StudioSourceDialog
          onClose={() => setShowSources(false)}
          onResource={async (resource) => {
            await onImportResource(resource);
            setComposition(await getComposition(project.projectId));
            setShowSources(false);
          }}
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
            <div className={cn(sharedStyles.track, studioStyles.studioTrack)} key={track.trackId}>
              <div className={studioStyles.trackPerson} title={track.name}>
                <button
                  className={"track-settings-trigger"}
                  aria-label={`${track.name} 트랙 설정`}
                  onClick={() => setTrackSettingsId(track.trackId)}
                >
                  <Avatar />
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
                {track.clips.map((clip) => (
                  <TimelineClip
                    key={clip.clipId}
                    clip={clip}
                    name={track.name}
                    color="var(--purple)"
                    maxTick={project.maxTick}
                    stepTick={(project.ppq * 2) / playback.signature.denominator}
                    cellPx={signatureGrid(playback.signature).cellPx}
                    movable={
                      !busy &&
                      clip.clipId > 0 &&
                      canMoveClip(viewerPermission, clip) &&
                      clip.clipType === "MIDI"
                    }
                    onError={setError}
                    onSelect={() => setTrackSettingsId(track.trackId)}
                    onEdit={
                      // Other participants' MIDI opens read-only; the editor never creates their drafts.
                      clip.clipType === "MIDI"
                        ? () => onEditTrack(track.trackId, clip.clipId > 0 ? clip.clipId : null)
                        : undefined
                    }
                    onMove={async (startTick) => {
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
                        const server = personalDrafts.find(
                          (item) =>
                            item.trackId === track.trackId && item.targetClipId === clip.clipId,
                        );
                        const session = new DraftSession({
                          context,
                          content: baseClip,
                          baseClip,
                          local,
                          server,
                          storage: browserDraftStorage(),
                          save: (request, id) =>
                            saveEditorDraft(project.projectId, track.trackId, id, request),
                        });
                        try {
                          session.edit({ ...session.getSnapshot().content, startTick });
                          await session.flush();
                        } finally {
                          session.dispose();
                        }
                        setPersonalDrafts(await getEditorDrafts(project.projectId));
                        const updated = await getComposition(project.projectId);
                        setComposition(updated);
                        rememberWork(updated, shortId);
                      } finally {
                        setBusy(false);
                      }
                    }}
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
                          setPendingAudio({
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

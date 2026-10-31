import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useState, type CSSProperties } from "react";
import { PublishConfirmation, VolumeDialog } from "@/components/app/dialog";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { rememberWork, rememberSubmission } from "@/features/workspace/workspace-store";
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
import type { SavedSource } from "@/features/community/saved-sources";
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
  saveMidiClip,
  submitContribution,
  updateProjectMetadata,
  uploadMedia,
  type CompositionDto,
} from "@/lib/api/composition";
import { errorText } from "./studio-helpers";
import { StudioToolbar } from "./studio-toolbar";
import { NewProject } from "./new-project-screen";

export function StudioScreen({
  go,
  shortId,
  projectId,
  returnToNotifications,
  onReturnToShort,
  onProjectSelected,
  onDraftCreated,
  onAddLayer,
  onEditTrack,
  onImportResource,
  onImportAudio,
  onExit,
}: {
  go: Navigate;
  shortId: number | null;
  projectId: number | null;
  returnToNotifications?: boolean;
  onExit?: () => void;
  onReturnToShort: (shortId: number) => void;
  onProjectSelected: (id: number) => void;
  onDraftCreated: (id: number) => void;
  onImportResource: (resource: Resource) => Promise<void>;
  onImportAudio: (source: SavedSource) => Promise<void>;
  onAddLayer: () => void;
  onEditTrack: (trackId: number, clipId: number | null) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const [trackSettingsId, setTrackSettingsId] = useState<number | null>(null);
  const [composition, setComposition] = useState<CompositionDto | null>(null);
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
  const playback = useCompositionPlayback(composition);

  useEffect(
    () => () => {
      if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
    },
    [pendingAudio],
  );

  useEffect(() => {
    if (shortId == null && projectId == null) return;
    let cancelled = false;
    (async () => {
      const id = shortId == null ? projectId! : (await enterComposition(shortId)).projectId;
      const result = await getComposition(id);
      if (!cancelled) {
        setComposition(result);
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
  }, [shortId, projectId, onProjectSelected]);

  async function refresh() {
    if (composition) setComposition(await getComposition(composition.project.projectId));
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
    const userId = composition.viewerPermission.userId;
    const draftClips = composition.tracks
      .flatMap((track) => track.clips)
      .filter((clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT");
    const items = [
      ...composition.tracks
        .filter(
          (track) =>
            track.ownerId === userId &&
            track.approvalStatus === "DRAFT" &&
            track.clips.some((clip) => draftClips.some((draft) => draft.clipId === clip.clipId)),
        )
        .map((track) => ({
          changeType: "ADD" as const,
          targetType: "TRACK" as const,
          targetId: track.trackId,
        })),
      ...draftClips.map((clip) => ({
        changeType: "ADD" as const,
        targetType: "CLIP" as const,
        targetId: clip.clipId,
      })),
    ];
    if (!draftClips.length) {
      setError("먼저 레이어에 노트나 오디오를 저장해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await submitContribution(
        composition.project.projectId,
        composition.project.version,
        items,
        submitComment.trim(),
      );
      try {
        rememberSubmission(composition, shortId, submitComment.trim());
      } catch {
        /* Submission has already succeeded on the server. */
      }
      setShowSubmitForm(false);
      go("submissions");
    } catch (cause) {
      setError(errorText(cause));
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
      if (composition.viewerPermission.canReviewContribution) {
        const latest = await getComposition(id);
        const userId = latest.viewerPermission.userId;
        const items = [
          ...latest.tracks
            .filter((track) => track.ownerId === userId && track.approvalStatus === "DRAFT")
            .map((track) => ({
              changeType: "ADD" as const,
              targetType: "TRACK" as const,
              targetId: track.trackId,
            })),
          ...latest.tracks
            .flatMap((track) => track.clips)
            .filter((clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT")
            .map((clip) => ({
              changeType: "ADD" as const,
              targetType: "CLIP" as const,
              targetId: clip.clipId,
            })),
        ];
        if (items.length) await submitContribution(id, latest.project.version, items);
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
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        const result = await getExport(id, exportId);
        const publishedShortId = completedExportShortId(result);
        if (publishedShortId !== null) {
          if (shortId == null) window.localStorage.removeItem("glitched-composition-draft-id");
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

  if (shortId == null && projectId == null)
    return (
      <NewProject
        onCreated={onDraftCreated}
        onResume={onProjectSelected}
        onBack={() => go("home")}
      />
    );
  if (!composition)
    return (
      <div
        className={cn(studioStyles.studio, studioStyles.studioState)}
        role={error ? "alert" : "status"}
      >
        <p>{error ?? "작곡 데이터를 불러오는 중입니다."}</p>
        {error && (
          <button
            onClick={onExit ?? (() => (shortId == null ? go("home") : onReturnToShort(shortId)))}
          >
            돌아가기
          </button>
        )}
      </div>
    );
  const { project, tracks, viewerPermission } = composition;
  const timelineWidth = (project.maxTick / Math.max(1, project.ppq / 2)) * 20;
  const canSubmit = shouldShowContributionSubmit(shortId, viewerPermission, tracks);
  const canPublish = shouldOfferSongPublish(shortId, viewerPermission, tracks);
  const layerCreationAllowed = canCreateLayer(viewerPermission, tracks, shortId === null);
  return (
    <div className={studioStyles.studio}>
      <StudioToolbar
        signature={playback.signature}
        onSignature={
          viewerPermission.canEdit
            ? (value) => {
                playback.pause();
                playback.setSignature(value);
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
        onBack={
          onExit ??
          (() =>
            returnToNotifications
              ? go("notifications")
              : shortId == null
                ? go("home")
                : onReturnToShort(shortId))
        }
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
      {error && !showSubmitForm && (
        <p className={studioStyles.studioError} role="alert">
          {error}
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
          return selected ? (
            <VolumeDialog
              track={selected}
              value={playback.trackVolumes[selected.trackId] ?? selected.volume}
              onChange={(value) => playback.setTrackVolume(selected.trackId, value)}
              onClose={() => setTrackSettingsId(null)}
            />
          ) : null;
        })()}
      {showSources && (
        <StudioSourceDialog
          onClose={() => setShowSources(false)}
          onResource={async (resource) => {
            await onImportResource(resource);
            setComposition(await getComposition(project.projectId));
            setShowSources(false);
          }}
          onAudio={async (source) => {
            await onImportAudio(source);
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
                      !busy && canMoveClip(viewerPermission, clip) && clip.clipType === "MIDI"
                    }
                    onError={setError}
                    onSelect={() => setTrackSettingsId(track.trackId)}
                    onEdit={
                      clip.clipType === "MIDI" && clip.ownerId === viewerPermission.userId
                        ? () => onEditTrack(track.trackId, clip.clipId)
                        : undefined
                    }
                    onMove={async (startTick) => {
                      if (overlapsClip(clip, startTick, track.clips))
                        throw new Error("같은 레이어의 다른 클립과 겹칠 수 없습니다.");
                      playback.pause();
                      setBusy(true);
                      setError(null);
                      try {
                        await saveMidiClip(
                          clip.clipId,
                          startTick,
                          clip.durationTick,
                          clip.midiNotes,
                        );
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

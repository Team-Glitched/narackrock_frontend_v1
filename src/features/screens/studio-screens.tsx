"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { PublishConfirmation, VolumeDialog, NoteSettingsDialog, InstrumentDialog, TimingDialog } from "@/components/app/dialog";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { rememberWork, rememberSubmission } from "@/features/workspace/workspace-store";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { prepareAudioFile } from "@/features/composition/prepare-audio-file";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import { canCreateLayer, shouldShowContributionSubmit, shouldOfferSongPublish } from "@/features/composition/contribution-session";
import { completedExportShortId } from "@/features/composition/publish-navigation";
import { pointerAxes, logicalBounds } from "@/features/composition/pointer-coordinates";
import { StudioSourceDialog } from "@/features/composition/studio-source-dialog";
import type { Resource } from "@/features/workspace/workspace-store";
import type { SavedSource } from "@/features/community/saved-sources";
import { defaultSignature, signatureGrid, musicalGridBackground, type TimeSignature } from "@/features/composition/time-signature";
import { MusicalRuler } from "@/features/composition/musical-ruler";
import { TimelineClip } from "@/features/composition/timeline-clip";
import { canMoveClip, overlapsClip } from "@/features/composition/timeline-move";
import { setPreviewTempo, movePreviewClip } from "@/features/preview/demo-api";
import { isPreviewMode } from "@/features/preview/preview-mode";
import "@/features/composition/studio-timeline.css";
import { TeamPianoRoll } from "@/features/composition/team-piano-roll";
import { createAudioClip, createDraftProject, createMidiClip, enterComposition, getComposition, getExport, getPendingContributions, publishComposition, reviewContribution, saveMidiClip, submitContribution, updateProjectMetadata, uploadMedia, type CompositionDto, type MidiNoteDto } from "@/lib/api/composition";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
const clockTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const subscribeToDraft = () => () => {};
const storedDraftId = () => {
  const value = Number(window.localStorage.getItem(isPreviewMode() ? "narackrock.preview.draft" : "glitched-composition-draft-id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export function StudioToolbar({ title, bpm, playing, positionMs, onPlay, onPause, onBack, children, piano, volume, onVolume, onAdd, metronome, onMetronome, onBpm, onImportSource, signature=defaultSignature, onSignature, addLabel = "타임라인 검토" }: {
  signature?:TimeSignature; onSignature?:(value:TimeSignature)=>void;
  addLabel?: string;
  onBpm?: (value: number) => void;
  onImportSource?:()=>void;
  title: string; bpm: number; playing: boolean; positionMs: number;
  onPlay: () => void; onPause: () => void; onBack: () => void; children?: React.ReactNode;
  metronome?: boolean; onMetronome?: () => void;
  piano?: boolean; volume?: number; onVolume?: (value: number) => void; onAdd?: () => void;
}) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [timing, setTiming] = useState<"bpm" | "beat" | null>(null);
  const masterVolume = <input className="studio-master-volume" type="range" min={0} max={100} value={volume ?? 20}
    onChange={(event) => onVolume?.(Number(event.target.value))} disabled={!onVolume}
    aria-label="마스터 볼륨" aria-valuetext={`${volume ?? 20}%`} />;
  return <div className={`studio-toolbar ${piano ? "team-original-toolbar" : ""}`}>
    <div className="studio-transport">
      <button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button>
      <button onClick={playing ? onPause : onPlay} aria-label={playing ? "일시정지" : "재생"}>{playing ? <span className="pause-symbol" /> : <Asset name="play.svg" />}</button>
      <button className="studio-metronome" aria-label="메트로놈" aria-pressed={metronome ?? false} onClick={onMetronome}><Asset name="metronome.svg" /></button>
    </div>
    <strong className="sr-only">{title}</strong>
    <div className="studio-readouts">
      <button className="studio-timing" onClick={() => setTiming("bpm")} aria-label="bpm 설정"><small>bpm</small>{bpm}</button>
      <button className="studio-timing" onClick={() => setTiming("beat")} aria-label="박자 설정"><small>beat</small>{signature.numerator}/{signature.denominator}</button>
      <span><small>time</small>{`00:${clockTime(positionMs)}`}</span>
      {onImportSource&&<button className="midi-import-trigger" aria-label="오픈소스 추가" onClick={onImportSource}><span aria-hidden="true">+</span><span>오픈소스</span></button>}
      {piano && <button className="studio-view-switch" aria-label="악기 선택" onClick={() => setInstrumentOpen(true)}><Asset name="studio-switch-down.svg" /><Asset name="studio-switch-up.svg" /></button>}
    </div>
    <div className="studio-volume"><button className="studio-volume-trigger" aria-label="음량 설정" onClick={() => setVolumeOpen(true)}><Asset name="sound.svg" /></button>{masterVolume}</div>
    {volumeOpen && <VolumeDialog value={volume ?? 20} onChange={value => onVolume?.(value)} onClose={() => setVolumeOpen(false)} />}
    {instrumentOpen && <InstrumentDialog onClose={() => setInstrumentOpen(false)} />}
    {timing && <TimingDialog signature={signature} onSignature={onSignature} bpm={bpm} beat={timing === "beat"} onChange={onBpm} onClose={() => setTiming(null)} />}
    {!piano && children}
    {piano && <><button className="studio-add" aria-label={addLabel} disabled={!onAdd} onClick={onAdd}><i /></button></>}
  </div>;
}

function NewProject({ onCreated, onResume }: { onCreated: (id: number) => void; onResume: (id: number) => void; onBack: () => void }) {
  const savedDraftId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true); setError(null);
    try {
      const { projectId } = await createDraftProject();
      window.localStorage.setItem(isPreviewMode() ? "narackrock.preview.draft" : "glitched-composition-draft-id", String(projectId));
      const imageId = image ? await uploadMedia(image, "IMAGE") : null;
      await updateProjectMetadata(projectId, title.trim(), imageId);
      onCreated(projectId);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <form className="project-create" onSubmit={start}>
    <label className="project-title-field">음악명<input aria-label="음악명" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required /></label>
    <label className="project-artwork-field">앨범<span className="project-artwork-picker">
      {imageUrl ? <Image src={imageUrl} alt="선택한 앨범" width={350} height={280} unoptimized /> : <><strong>앨범 추가</strong><small>JPG, PNG, WEBP 최대 100MB</small></>}
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="앨범 추가" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 100 * 1024 * 1024) { setError("100MB 이하의 이미지를 선택해 주세요."); return; }
        setImage(file); setImageUrl(URL.createObjectURL(file)); setError(null);
      }} />
    </span></label>
    {error && <p className="project-error" role="alert">{error}</p>}
    <div className="project-create-actions"><button className="purple-pill" type="submit" disabled={busy || !title.trim()}>{busy ? "만드는 중…" : "입력 완료"}</button>
    {savedDraftId && <button className="resume-draft" type="button" onClick={() => onResume(savedDraftId)}>이전 작업 이어하기</button>}</div>
  </form>;
}

export function StudioScreen({ go, shortId, projectId, returnToNotifications, onReturnToShort, onProjectSelected, onDraftCreated, onAddLayer, onEditTrack, onImportResource, onImportAudio, onExit }: {
  go: Navigate; shortId: number | null; projectId: number | null;
  returnToNotifications?: boolean;
  onExit?:()=>void;
  onReturnToShort: (shortId: number) => void;
  onProjectSelected: (id: number) => void; onDraftCreated: (id: number) => void;
  onImportResource:(resource:Resource)=>Promise<void>;onImportAudio:(source:SavedSource)=>Promise<void>;
  onAddLayer: () => void; onEditTrack: (trackId: number, clipId: number | null) => void;
}) {
  const [showSources,setShowSources]=useState(false);
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
  const [pendingAudio, setPendingAudio] = useState<{ trackId: number; file: File; url: string } | null>(null);
  const playback = useCompositionPlayback(composition);

  useEffect(() => () => { if (pendingAudio) URL.revokeObjectURL(pendingAudio.url); }, [pendingAudio]);

  useEffect(() => {
    if (shortId == null && projectId == null) return;
    let cancelled = false;
    (async () => {
      const id = shortId == null ? projectId! : (await enterComposition(shortId)).projectId;
      const result = await getComposition(id);
      if (!cancelled) { setComposition(result); try{rememberWork(result,shortId);}catch{/* The server project remains available if browser storage is full. */} if (id !== projectId) onProjectSelected(id); }
    })().catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [shortId, projectId, onProjectSelected]);

  async function refresh() { if (composition) setComposition(await getComposition(composition.project.projectId)); }
  async function addAudio(trackId: number, file: File, selection: AudioSelection) {
    if (!composition || busy) throw new Error("잠시 후 다시 시도해 주세요.");
    setBusy(true); setError(null);
    try {
      const { wav, durationMs } = await prepareAudioFile(file, selection);
      if (durationMs > composition.project.maxDurationMs) throw new Error("오디오는 1분 이하여야 합니다.");
      const { bpm, ppq, maxTick, projectId: id } = composition.project;
      const durationTick = Math.max(1, Math.min(maxTick, Math.ceil(durationMs * bpm * ppq / 60_000)));
      await createAudioClip(id, trackId, await uploadMedia(wav, "AUDIO"), durationTick);
      await refresh();
    } finally { setBusy(false); }
  }

  async function submitDrafts(event: React.FormEvent) {
    event.preventDefault();
    if (!composition || busy || !submitComment.trim()) return;
    const userId = composition.viewerPermission.userId;
    const draftClips = composition.tracks.flatMap((track) => track.clips)
      .filter((clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT");
    const items = [
      ...composition.tracks.filter((track) => track.ownerId === userId && track.approvalStatus === "DRAFT"
        && track.clips.some((clip) => draftClips.some((draft) => draft.clipId === clip.clipId)))
        .map((track) => ({ changeType: "ADD" as const, targetType: "TRACK" as const, targetId: track.trackId })),
      ...draftClips.map((clip) => ({ changeType: "ADD" as const, targetType: "CLIP" as const, targetId: clip.clipId })),
    ];
    if (!draftClips.length) { setError("먼저 레이어에 노트나 오디오를 저장해 주세요."); return; }
    setBusy(true); setError(null); setStatus(null);
    try {
      await submitContribution(composition.project.projectId, composition.project.version, items, submitComment.trim());
      try{rememberSubmission(composition,shortId,submitComment.trim());}catch{/* Submission has already succeeded on the server. */}
      setShowSubmitForm(false);
      go("submissions");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function publish(afterMetadataSave = false) {
    if (!composition || (busy && !afterMetadataSave)) return;
    setBusy(true); setError(null); setStatus("숏폼 음원을 생성하는 중입니다.");
    try {
      const id = composition.project.projectId;
      if (composition.viewerPermission.canReviewContribution) {
        const latest = await getComposition(id);
        const userId = latest.viewerPermission.userId;
        const items = [
          ...latest.tracks.filter((track) => track.ownerId === userId && track.approvalStatus === "DRAFT")
            .map((track) => ({ changeType: "ADD" as const, targetType: "TRACK" as const, targetId: track.trackId })),
          ...latest.tracks.flatMap((track) => track.clips)
            .filter((clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT")
            .map((clip) => ({ changeType: "ADD" as const, targetType: "CLIP" as const, targetId: clip.clipId })),
        ];
        if (items.length) await submitContribution(id, latest.project.version, items);
        for (const pending of (await getPendingContributions(id)).filter((item) => item.userId === userId)) {
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
          if (shortId == null) window.localStorage.removeItem(isPreviewMode() ? "narackrock.preview.draft" : "glitched-composition-draft-id");
          onReturnToShort(publishedShortId);
          return;
        }
        if (result.status === "FAILED") throw new Error(result.errorMessage ?? "음원 생성에 실패했습니다.");
      }
      setStatus("음원 생성이 계속 진행 중입니다. 잠시 후 숏폼에서 확인해 주세요.");
    } catch (cause) { setError(errorText(cause)); setStatus(null); }
    finally { setBusy(false); }
  }

  function requestPublish() {
    if (!composition) return;
    if (!composition.tracks.some((track) => track.clips.length)) {
      setError("먼저 피아노롤 노트나 오디오 파일을 레이어에 저장해 주세요."); return;
    }
    if (composition.project.title === "제목 없는 곡") {
      setPublishTitle("");
      setShowPublishForm(true);
    } else setShowPublishConfirmation(true);
  }

  async function finishMetadata(event: React.FormEvent) {
    event.preventDefault();
    if (!composition || !publishTitle.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const imageId = publishImage ? await uploadMedia(publishImage, "IMAGE") : null;
      await updateProjectMetadata(composition.project.projectId, publishTitle.trim(), imageId);
      await refresh();
      setShowPublishForm(false);
      setShowPublishConfirmation(true);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (shortId == null && projectId == null) return <NewProject onCreated={onDraftCreated} onResume={onProjectSelected} onBack={() => go("home")} />;
  if (!composition) return <div className="studio studio-state" role={error ? "alert" : "status"}><p>{error ?? "작곡 데이터를 불러오는 중입니다."}</p>{error && <button onClick={onExit??(()=>shortId == null ? go("home") : onReturnToShort(shortId))}>돌아가기</button>}</div>;
  const { project, tracks, viewerPermission } = composition;
  const timelineWidth = project.maxTick / Math.max(1, project.ppq / 2) * 20;
  const canSubmit = shouldShowContributionSubmit(shortId, viewerPermission, tracks);
  const canPublish = shouldOfferSongPublish(shortId, viewerPermission, tracks);
  const layerCreationAllowed = canCreateLayer(viewerPermission, tracks,shortId===null);
  return <div className="studio">
    <StudioToolbar signature={playback.signature} onSignature={viewerPermission.canEdit?value=>{playback.pause();playback.setSignature(value);}:undefined} title={project.title} bpm={project.bpm} playing={playback.playing} positionMs={playback.positionMs}
      onPlay={() => { void playback.play(); }} onPause={playback.pause} volume={playback.volume} onVolume={playback.setVolume} metronome={playback.metronome} onMetronome={() => playback.setMetronome(value => !value)} onBpm={isPreviewMode() && shortId == null ? bpm => { playback.pause(); setComposition(setPreviewTempo(composition.project.projectId, bpm)); } : undefined}
      onImportSource={layerCreationAllowed?()=>{playback.pause();setShowSources(true);}:undefined}
      onBack={onExit??(() => returnToNotifications ? go("notifications") : shortId == null ? go("home") : onReturnToShort(shortId))}>
      {canSubmit ? <button className="studio-submit" onClick={() => { setError(null); setShowSubmitForm(true); }} disabled={busy}>제출하기</button>
        : <button className="studio-add" onClick={canPublish ? requestPublish : onAddLayer} disabled={busy || (!(shortId == null && viewerPermission.canExport) && !layerCreationAllowed)} aria-label={canPublish ? "곡 올리기" : "레이어 추가"}
          title={!layerCreationAllowed && viewerPermission.canContribute ? "한 곡에는 하나의 레이어만 만들 수 있습니다." : undefined}><i /></button>}
    </StudioToolbar>
    {error && !showSubmitForm && <p className="studio-error" role="alert">{error}</p>}
    {status && <div className="studio-workflow">

      {status && <span role="status">{status}</span>}
    </div>}
    {showSubmitForm && <form className="studio-publish-form studio-submit-form" onSubmit={(event) => { void submitDrafts(event); }} role="dialog" aria-modal="true" aria-labelledby="submit-heading">
      <h2 id="submit-heading">작업 제출</h2>
      <p>추가한 레이어를 원곡자에게 보냅니다. 승인되면 숏폼에 반영됩니다.</p>
      <label>한 줄 코멘트<input value={submitComment} onChange={(event) => setSubmitComment(event.target.value)} maxLength={120} required placeholder="어떤 작업을 추가했나요?" autoFocus /></label>
      {error && <p role="alert">{error}</p>}
      <div><button type="button" onClick={() => { setShowSubmitForm(false); setError(null); }} disabled={busy}>취소</button><button type="submit" disabled={busy || !submitComment.trim()}>{busy ? "제출 중..." : "제출하기"}</button></div>
    </form>}
    {showPublishConfirmation && <PublishConfirmation onClose={() => setShowPublishConfirmation(false)} onConfirm={() => { setShowPublishConfirmation(false); void publish(); }} />}
    {showPublishForm && <form className="studio-publish-form" onSubmit={finishMetadata}>
      <h2>곡 올리기</h2><p>곡 제목을 등록하세요. 앨범 이미지는 선택사항입니다.</p>
      <label>곡 제목<input value={publishTitle} onChange={(event) => setPublishTitle(event.target.value)} required maxLength={100} /></label>
      <label>앨범 이미지 (선택)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setPublishImage(event.target.files?.[0] ?? null)} /></label>
      <div><button type="button" onClick={() => setShowPublishForm(false)}>취소</button><button disabled={busy} type="submit">{busy ? "저장 중..." : "정보 저장"}</button></div>
    </form>}
    {pendingAudio && <div className="studio-audio-dialog" role="dialog" aria-modal="true" aria-labelledby="audio-trim-heading">
      <div className="studio-audio-dialog-content">
        <h2 id="audio-trim-heading">파일 구간 선택</h2>
        <p>{pendingAudio.file.name}</p>
        <AudioTrimPicker url={pendingAudio.url} saveLabel="선택 구간을 레이어에 저장"
          onCancel={() => setPendingAudio(null)}
          onSave={async (selection) => {
            await addAudio(pendingAudio.trackId, pendingAudio.file, selection);
            setPendingAudio(null);
          }} />
      </div>
    </div>}
    {trackSettingsId !== null && (() => { const selected = tracks.find(track => track.trackId === trackSettingsId); return selected ? <VolumeDialog track={selected} value={playback.trackVolumes[selected.trackId] ?? selected.volume} onChange={value => playback.setTrackVolume(selected.trackId, value)} onClose={() => setTrackSettingsId(null)} /> : null; })()}
    {showSources&&<StudioSourceDialog onClose={()=>setShowSources(false)} onResource={async resource=>{await onImportResource(resource);setComposition(await getComposition(project.projectId));setShowSources(false);}} onAudio={async source=>{await onImportAudio(source);setComposition(await getComposition(project.projectId));setShowSources(false);}}/>}
    <div className="timeline" style={{ "--timeline-lanes": tracks.length } as CSSProperties}><div className="timeline-content" style={{ minWidth: 98 + timelineWidth }}>
      <div className="ruler" style={{ width: timelineWidth }} role="slider" tabIndex={0} aria-label="타임라인 재생 위치" aria-valuemin={0} aria-valuemax={project.maxDurationMs} aria-valuenow={Math.round(playback.positionMs)}
        onPointerDown={event => { const bounds = logicalBounds(event.currentTarget); playback.seek(Math.max(0, Math.min(project.maxDurationMs, (pointerAxes(event.currentTarget, event).x - bounds.left) / bounds.width * project.maxDurationMs))); }}
        onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); playback.seek(event.key === "Home" ? 0 : event.key === "End" ? project.maxDurationMs : Math.max(0, Math.min(project.maxDurationMs, playback.positionMs + (event.key === "ArrowRight" ? 1 : -1) * 30000 / project.bpm))); }}>
        <MusicalRuler signature={playback.signature} width={timelineWidth}/></div>
      <div className="timeline-sidebar-fill" aria-hidden="true" />
      <div className="studio-playhead" hidden={!playback.playing && playback.positionMs === 0} style={{ left: `${98 + playback.positionMs / project.maxDurationMs * timelineWidth}px` }} />
      <div className="timeline-grid-fill" aria-hidden="true" style={{width: timelineWidth,backgroundImage:`repeating-linear-gradient(to bottom,transparent 0 42px,var(--black) 42px 46px),${musicalGridBackground(playback.signature)},repeating-linear-gradient(to bottom,var(--grid-cell) 0 1px,var(--grid-row) 1px 41px,var(--grid-cell) 41px 42px,var(--black) 42px 46px,var(--grid-cell) 46px 47px,var(--grid-row-alt) 47px 87px,var(--grid-cell) 87px 88px,var(--black) 88px 92px)`}} />
      {tracks.map((track) => <div className="track studio-track" key={track.trackId}>
        <div className="track-person" title={track.name}><button className="track-settings-trigger" aria-label={`${track.name} 트랙 설정`} onClick={() => setTrackSettingsId(track.trackId)}><Avatar /></button><button aria-label={`${track.name} ${playback.mutedTrackIds.has(track.trackId) ? "소리 켜기" : "음소거"}`} aria-pressed={playback.mutedTrackIds.has(track.trackId)} onClick={() => playback.toggleTrackMute(track.trackId)}><Asset name={playback.mutedTrackIds.has(track.trackId) ? "sound-muted.svg" : "sound.svg"} /></button></div>
        <div className="studio-track-clips" style={{ width: timelineWidth, flexBasis: timelineWidth }}>{track.clips.map((clip) => <TimelineClip key={clip.clipId} clip={clip} name={track.name} color="var(--purple)" maxTick={project.maxTick} stepTick={project.ppq*2/playback.signature.denominator} cellPx={signatureGrid(playback.signature).cellPx} movable={!busy&&canMoveClip(viewerPermission,clip)&&(isPreviewMode()||clip.clipType==="MIDI")}
          onError={setError} onSelect={()=>setTrackSettingsId(track.trackId)} onEdit={clip.clipType==="MIDI"&&clip.ownerId===viewerPermission.userId?()=>onEditTrack(track.trackId,clip.clipId):undefined}
          onMove={async startTick=>{if(overlapsClip(clip,startTick,track.clips))throw new Error("같은 레이어의 다른 클립과 겹칠 수 없습니다.");playback.pause();setBusy(true);setError(null);try{let updated;if(isPreviewMode())updated=movePreviewClip(project.projectId,clip.clipId,startTick);else{await saveMidiClip(clip.clipId,startTick,clip.durationTick,clip.midiNotes);updated=await getComposition(project.projectId);}setComposition(updated);rememberWork(updated,shortId);}finally{setBusy(false);}}}/>)}</div>
        {track.ownerId === viewerPermission.userId && <div className="studio-track-actions">
          {track.instrument && <button onClick={() => onEditTrack(track.trackId, null)}>+ 노트</button>}
          <label className="studio-upload">+ 파일<input type="file" accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac" disabled={busy || !viewerPermission.canContribute}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) setPendingAudio({ trackId: track.trackId, file, url: URL.createObjectURL(file) }); event.target.value = ""; }} /></label>
        </div>}
      </div>)}
    </div></div>
  </div>;
}
export function NoteEditorScreen({ projectId, trackId, clipId, onBack, onImportResource }: {
  onImportResource:(resource:Resource)=>Promise<void>;
  projectId: number | null; trackId: number | null; clipId: number | null; onBack: () => void; onAddLayer: () => void;
}) {
  const [showSources,setShowSources]=useState(false);
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [noteSettingsIndex, setNoteSettingsIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState<MidiNoteDto[]>([]);
  const lengthCells = 1;
  const [initialPitch, setInitialPitch] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  const clip = track?.clips.find((item) => item.clipId === clipId && item.clipType === "MIDI")
    ?? (clipId === null ? track?.clips.find((item) => item.clipType === "MIDI") : undefined);
  const editable = Boolean(composition && track && (clip ? clip.ownerId === composition.viewerPermission.userId : track.ownerId === composition.viewerPermission.userId && composition.viewerPermission.canContribute));

  const maxTick = composition?.project.maxTick ?? 57_600;
  const clipStartTick = clip?.startTick ?? 0;
  const preview = useMemo(() => {
    if (!composition || !track) return null;
    const previewClip = clip ? { ...clip, midiNotes: notes }
      : { clipId: -1, ownerId: composition.viewerPermission.userId, clipType: "MIDI" as const,
        sourceType: "MIDI_INPUT", mediaFileId: null, mediaUrl: null, startTick: 0,
        durationTick: maxTick, startTimeMs: 0, durationMs: composition.project.maxDurationMs,
        clipOffsetMs: 0, approvalStatus: "DRAFT", midiNotes: notes };
    return { ...composition, tracks: [{ ...track, isMuted: false, isSolo: false, clips: [previewClip] }] };
  }, [composition, track, clip, notes, maxTick]);
  const playback = useCompositionPlayback(preview);
  const stepTick = (composition?.project.ppq??480)*2/playback.signature.denominator;

  useEffect(() => {
    if (projectId == null || trackId == null) return;
    let cancelled = false;
    getComposition(projectId).then((result) => {
      if (cancelled) return;
      const found = result.tracks.find((item) => item.trackId === trackId)?.clips.find((item) => item.clipId === clipId);
      setComposition(result); setNotes(found?.midiNotes ?? []);
      setInitialPitch(found?.midiNotes?.[0]?.pitch ?? 60);
    }).catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [projectId, trackId, clipId]);

  async function save(afterSave = onBack) {
    if (!composition || !track || !editable || busy) return;
    setBusy(true); setError(null);
    try {
      const durationTick = Math.max(clip?.durationTick ?? 0, stepTick, ...notes.map((note) => note.startTick + note.durationTick));
      if (clip) await saveMidiClip(clip.clipId, clipStartTick, durationTick, notes);
      else await createMidiClip(composition.project.projectId, track.trackId, 0, durationTick, notes);
      setComposition(await getComposition(composition.project.projectId));
      afterSave();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (!composition || !track) return <div className="studio studio-state" role={error ? "alert" : "status"}>{error ?? (projectId == null || trackId == null ? "편집할 MIDI를 작곡 화면에서 먼저 선택해주세요." : composition ? "선택한 MIDI 레이어를 찾을 수 없습니다." : "피아노롤을 불러오는 중입니다.")}<button onClick={onBack}>돌아가기</button></div>;
  return <div className="studio note-editor">
    <StudioToolbar signature={playback.signature} onSignature={composition.viewerPermission.canEdit?value=>{playback.pause();playback.setSignature(value);}:undefined} title={`${track.name} · 피아노롤`} bpm={composition.project.bpm} playing={playback.playing} positionMs={playback.positionMs}
      onPlay={() => { void playback.play(); }} onPause={playback.pause} onBack={() => { if (editable) void save(); else onBack(); }}
      piano volume={playback.volume} onVolume={playback.setVolume} metronome={playback.metronome} onMetronome={() => playback.setMetronome(value => !value)} onBpm={isPreviewMode() ? bpm => { playback.pause(); setComposition(setPreviewTempo(composition.project.projectId, bpm)); } : undefined}
      onImportSource={editable?()=>void save(()=>setShowSources(true)):undefined}
      onAdd={() => { if (editable) void save(); else onBack(); }}>

    </StudioToolbar>
    {error && <p className="studio-error" role="alert">{error}</p>}
    {!editable && <p className="studio-error">다른 참여자의 MIDI는 수정할 수 없습니다. 새 클립을 만들어 주세요.</p>}
    {showSources&&<StudioSourceDialog midiOnly onClose={()=>setShowSources(false)} onAudio={async()=>{throw new Error("피아노롤에는 MIDI 노트만 추가할 수 있습니다.");}} onResource={async resource=>{await onImportResource(resource);const latest=await getComposition(composition.project.projectId);const updatedTrack=latest.tracks.find(item=>item.trackId===track.trackId);const updatedClip=updatedTrack?.clips.find(item=>item.clipId===clipId&&item.clipType==="MIDI")??updatedTrack?.clips.find(item=>item.clipType==="MIDI");setComposition(latest);setNotes(updatedClip?.midiNotes??[]);setShowSources(false);}}/>}
    {noteSettingsIndex !== null && notes[noteSettingsIndex] && <NoteSettingsDialog note={notes[noteSettingsIndex]} instrument={track.instrument} stepTick={stepTick} maxTick={maxTick - clipStartTick} onClose={() => setNoteSettingsIndex(null)} onChange={updated => setNotes(current => { if (current.some((note,index) => index !== noteSettingsIndex && note.pitch === updated.pitch && updated.startTick < note.startTick + note.durationTick && updated.startTick + updated.durationTick > note.startTick)) return current; return current.map((note,index) => index === noteSettingsIndex ? updated : note); })} />}
    <TeamPianoRoll signature={playback.signature} onSettings={setNoteSettingsIndex} notes={notes} setNotes={setNotes} stepTick={stepTick}
      maxTick={maxTick - clipStartTick} lengthCells={lengthCells} editable={editable}
      positionMs={playback.positionMs} maxDurationMs={composition.project.maxDurationMs}
      onSeek={playback.seek} initialPitch={initialPitch} />
  </div>;
}

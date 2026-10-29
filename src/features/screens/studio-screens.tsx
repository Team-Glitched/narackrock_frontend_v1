"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import type { MusicalTiming } from "@/features/composition/musical-time";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { prepareAudioFile } from "@/features/composition/prepare-audio-file";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import { canCreateLayer, hasOwnDraftClip, shouldShowContributionSubmit } from "@/features/composition/contribution-session";
import { completedExportShortId } from "@/features/composition/publish-navigation";
import { PianoRollStudio } from "@/features/composition/piano-roll-studio";
import { useNoteHistory } from "@/features/composition/use-note-history";
import { ChordPicker } from "@/features/composition/chord-picker";
import { chordStartTick, insertChord, type ChordQuality } from "@/features/composition/chord-input";
import { instrumentFor } from "@/features/composition/instrument-catalog";
import { createAudioClip, createDraftProject, enterComposition, getComposition, getExport, getPendingContributions, publishComposition, reviewContribution, submitContribution, updateProjectMetadata, updateProjectTiming, uploadMedia, type CompositionDto, type MidiNoteDto, type TrackDto, type ProjectTimingDto } from "@/lib/api/composition";

import { useEditorDraft, browserDraftStorage } from "@/features/composition/use-editor-draft";
import { listLocalDrafts, type DraftContent, type ServerDraft } from "@/features/composition/editor-draft";
import { clearCommittedRecovery, syncProjectEditorDrafts } from "@/features/composition/project-editor-drafts";
import { getEditorDrafts, commitEditorDrafts, submitEditorDrafts } from "@/lib/api/composition-drafts";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
const clockTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const subscribeToDraft = () => () => {};
const storedDraftId = () => {
  const value = Number(window.localStorage.getItem("glitched-composition-draft-id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

function StudioToolbar({ title, bpm, playing, positionMs, onPlay, onPause, onBack, children, piano, volume, onVolume, onAdd }: {
  title: string; bpm: number; playing: boolean; positionMs: number;
  onPlay: () => void; onPause: () => void; onBack: () => void; children?: React.ReactNode;
  piano?: boolean; volume?: number; onVolume?: (value: number) => void; onAdd?: () => void;
}) {
  const masterVolume = <input className="studio-master-volume" type="range" min={0} max={100} value={volume ?? 20}
    onChange={(event) => onVolume?.(Number(event.target.value))} disabled={!onVolume}
    aria-label="마스터 볼륨" aria-valuetext={`${volume ?? 20}%`} />;
  return <div className={`studio-toolbar ${piano ? "team-original-toolbar" : ""}`}>
    <button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button>
    <button onClick={playing ? onPause : onPlay} aria-label={playing ? "일시정지" : "재생"} className={playing ? "is-playing" : ""}><Asset name="play.svg" /></button>
    {piano && <Asset name="metronome.svg" />}
    {!piano && <strong className="studio-title">{title}</strong>}
    <span><small>bpm</small>{bpm}</span>
    {piano && <span><small>beat</small>4/4</span>}
    <span><small>time</small>{clockTime(positionMs)}</span>
    {piano ? <div className="studio-volume"><Asset name="sound.svg" />{masterVolume}</div> : masterVolume}
    {children}
    {piano && onAdd && <button className="studio-add" aria-label="레이어 추가" onClick={onAdd}><i /></button>}
  </div>;
}

function NewProject({ onCreated, onResume, onBack }: { onCreated: (id: number) => void; onResume: (id: number) => void; onBack: () => void }) {
  const savedDraftId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { projectId } = await createDraftProject();
      window.localStorage.setItem("glitched-composition-draft-id", String(projectId));
      onCreated(projectId);
    }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <div className="studio studio-empty">
    <StudioToolbar title="새 곡" bpm={120} playing={false} positionMs={0} onPlay={() => {}} onPause={() => {}} onBack={onBack} />
    <div className="studio-form"><h2>새 곡 만들기</h2>
      <p>레이어를 만들고 작곡해 보세요. 제목은 곡을 올릴 때 등록하고 앨범 이미지는 선택할 수 있습니다.</p>
      {savedDraftId && <button type="button" onClick={() => onResume(savedDraftId)}>이전 작업 이어하기</button>}
      <button type="button" disabled={busy} onClick={() => { void start(); }}>{busy ? "만드는 중..." : "빈 곡에서 시작"}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}

export function StudioScreen({ go, shortId, projectId, returnToNotifications, onReturnToShort, onProjectSelected, onDraftCreated, onAddLayer, onEditTrack }: {
  go: Navigate; shortId: number | null; projectId: number | null;
  returnToNotifications?: boolean;
  onReturnToShort: (shortId: number) => void;
  onProjectSelected: (id: number) => void; onDraftCreated: (id: number) => void;
  onAddLayer: () => void; onEditTrack: (trackId: number, clipId: number | null) => void;
}) {
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [serverDrafts, setServerDrafts] = useState<ServerDraft[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitComment, setSubmitComment] = useState("");
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
      if (!cancelled) { setComposition(result); if (id !== projectId) onProjectSelected(id); }
      if (result.viewerPermission.canContribute) {
        try { const drafts = await getEditorDrafts(id); if (!cancelled) { setServerDrafts(drafts); setDraftError(null); } }
        catch (cause) { if (!cancelled) setDraftError(errorText(cause)); }
      }
    })().catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [shortId, projectId, onProjectSelected]);

  async function refresh() {
    if (!composition) return;
    const id = composition.project.projectId;
    setComposition(await getComposition(id));
    try { setServerDrafts(await getEditorDrafts(id)); setDraftError(null); }
    catch (cause) { setDraftError(errorText(cause)); }
  }
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
    setBusy(true); setError(null); setStatus(null);
    try {
      const id = composition.project.projectId;
      const drafts = await syncProjectEditorDrafts(id, composition.viewerPermission.userId, browserDraftStorage());
      await submitEditorDrafts(id, drafts, composition.project.version, submitComment.trim());
      clearCommittedRecovery(browserDraftStorage(), drafts);
      setShowSubmitForm(false);
      onReturnToShort(shortId!);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function publish(afterMetadataSave = false) {
    if (!composition || (busy && !afterMetadataSave)) return;
    setBusy(true); setError(null); setStatus("숏폼 음원을 생성하는 중입니다.");
    try {
      const id = composition.project.projectId;
      const drafts = await syncProjectEditorDrafts(id, composition.viewerPermission.userId, browserDraftStorage());
      if (drafts.length) clearCommittedRecovery(browserDraftStorage(), await commitEditorDrafts(id, drafts));
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
          if (shortId == null) window.localStorage.removeItem("glitched-composition-draft-id");
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
    if (!composition.tracks.some((track) => track.clips.length) && !workingDrafts.size) {
      setError("먼저 피아노롤 노트나 오디오 파일을 레이어에 저장해 주세요."); return;
    }
    if (composition.project.title === "제목 없는 곡") {
      setPublishTitle("");
      setShowPublishForm(true);
    } else void publish();
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
      await publish(true);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (shortId == null && projectId == null) return <NewProject onCreated={onDraftCreated} onResume={onProjectSelected} onBack={() => go("home")} />;
  if (!composition) return <div className="studio studio-state" role={error ? "alert" : "status"}><p>{error ?? "작곡 데이터를 불러오는 중입니다."}</p>{error && <button onClick={() => shortId == null ? go("home") : onReturnToShort(shortId)}>돌아가기</button>}</div>;
  const { project, tracks, viewerPermission } = composition;
  const hasDraftClip = hasOwnDraftClip(tracks, viewerPermission.userId);
  const workingDrafts = new Map<string, { trackId: number; targetClipId: number | null }>();
  for (const draft of [...serverDrafts, ...listLocalDrafts(browserDraftStorage(), viewerPermission.userId, project.projectId)]) {
    if (tracks.some(t => t.trackId === draft.trackId && t.ownerId === viewerPermission.userId
      && (t.approvalStatus === "DRAFT" || t.approvalStatus === "APPROVED"))) {
      workingDrafts.set(`${draft.trackId}:${draft.targetClipId ?? "new"}`, draft);
    }
  }
  const canSubmit = shouldShowContributionSubmit(shortId, viewerPermission, tracks, workingDrafts.size);
  const layerCreationAllowed = canCreateLayer(viewerPermission, tracks);
  return <div className="studio">
    <StudioToolbar title={project.title} bpm={project.bpm} playing={playback.playing} positionMs={playback.positionMs}
      onPlay={() => { void playback.play(); }} onPause={playback.pause} volume={playback.volume} onVolume={playback.setVolume}
      onBack={() => returnToNotifications ? go("notifications") : shortId == null ? go("home") : onReturnToShort(shortId)}>
      {canSubmit ? <button className="studio-submit" onClick={() => { setError(null); setShowSubmitForm(true); }} disabled={busy}>제출하기</button>
        : <button className="studio-add" onClick={onAddLayer} disabled={!layerCreationAllowed} aria-label="레이어 추가"
          title={!layerCreationAllowed && viewerPermission.canContribute ? "한 곡에는 하나의 레이어만 만들 수 있습니다." : undefined}><i /></button>}
    </StudioToolbar>
    {error && !showSubmitForm && <p className="studio-error" role="alert">{error}</p>}
    {playback.error && !error && <p className="studio-error" role="alert">{playback.error}</p>}
    {(workingDrafts.size > 0 || draftError) && <div className="studio-draft-resume">
      {workingDrafts.size > 0 && <><span>작업 중인 개인 초안이 있습니다.</span>{[...workingDrafts.values()].map(d =>
        <button key={`${d.trackId}:${d.targetClipId ?? "new"}`} onClick={() => onEditTrack(d.trackId, d.targetClipId)} disabled={busy}>
          {tracks.find(t => t.trackId === d.trackId)?.name} · 이어서 작곡하기
        </button>)}</>}
      {draftError && <><span role="alert">개인 초안을 불러오지 못했습니다. {draftError}</span><button onClick={() => { void refresh(); }}>다시 불러오기</button></>}
    </div>}
    {((shortId == null && viewerPermission.canExport && (project.status === "DRAFT" || hasDraftClip || workingDrafts.size > 0)) || status) && <div className="studio-workflow">
      {shortId == null && viewerPermission.canExport && (project.status === "DRAFT" || hasDraftClip || workingDrafts.size > 0) && <button onClick={requestPublish} disabled={busy}>{project.status === "DRAFT" ? "곡 올리기" : "내 변경 반영"}</button>}
      {status && <span role="status">{status}</span>}
    </div>}
    {showSubmitForm && <form className="studio-publish-form studio-submit-form" onSubmit={(event) => { void submitDrafts(event); }} role="dialog" aria-modal="true" aria-labelledby="submit-heading">
      <h2 id="submit-heading">작업 제출</h2>
      <p>추가한 레이어를 원곡자에게 보냅니다. 승인되면 숏폼에 반영됩니다.</p>
      <label>한 줄 코멘트<input value={submitComment} onChange={(event) => setSubmitComment(event.target.value)} maxLength={120} required placeholder="어떤 작업을 추가했나요?" autoFocus /></label>
      {error && <p role="alert">{error}</p>}
      <div><button type="button" onClick={() => { setShowSubmitForm(false); setError(null); }} disabled={busy}>취소</button><button type="submit" disabled={busy || !submitComment.trim()}>{busy ? "제출 중..." : "제출하기"}</button></div>
    </form>}
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
    <div className="timeline"><div className="timeline-content">
      <div className="ruler">{Array.from({ length: 45 }, (_, index) => <i key={index} />)}</div>
      <div className="studio-playhead" style={{ left: `${120 + playback.positionMs / project.maxDurationMs * 756}px` }} />
      {tracks.length === 0 && <p className="studio-hint">레이어를 추가해 작곡을 시작하세요.</p>}
      {tracks.map((track) => <div className="track studio-track" key={track.trackId}>
        <div className="track-person"><strong title={track.name}>{track.name}</strong><small>{track.instrument ? instrumentFor(track.instrument).label : "오디오"}</small></div>
        <div className="studio-track-clips">{track.clips.map((clip) => <button key={clip.clipId} className={`studio-clip ${clip.clipType === "MIDI" ? "midi" : "audio"}`}
          style={{ left: `${clip.startTick / project.maxTick * 100}%`, width: `${Math.max(4, clip.durationTick / project.maxTick * 100)}%` }}
          onClick={() => { if (clip.clipType === "MIDI") onEditTrack(track.trackId, clip.clipId); }}
          aria-label={`${track.name} ${clip.clipType === "MIDI" ? "MIDI 편집" : "오디오 클립"}`}>
          {clip.clipType === "MIDI" ? `${clip.midiNotes?.length ?? 0} notes` : "Audio"}
        </button>)}</div>
        <div className="studio-track-actions">
          {track.instrument && track.ownerId === viewerPermission.userId && viewerPermission.canContribute
            && (track.approvalStatus === "DRAFT" || track.approvalStatus === "APPROVED")
            && <button onClick={() => onEditTrack(track.trackId, null)} disabled={busy}>{track.clips.length ? "+ 노트" : "작곡 이어하기"}</button>}
          <label className="studio-upload">+ 파일<input type="file" accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac" disabled={busy || !viewerPermission.canContribute}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) setPendingAudio({ trackId: track.trackId, file, url: URL.createObjectURL(file) }); event.target.value = ""; }} /></label>
        </div>
      </div>)}
    </div></div>
  </div>;
}
export function NoteEditorScreen({ projectId, trackId, clipId, onBack, onAddLayer, onClipSelected }: {
  projectId: number | null; trackId: number | null; clipId: number | null; onBack: () => void; onAddLayer: () => void;
  onClipSelected: (trackId: number, clipId: number | null) => void;
}) {
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (projectId == null || trackId == null) return;
    let cancelled = false;
    getComposition(projectId).then(result => { if (!cancelled) setComposition(result); })
      .catch(cause => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [projectId, trackId]);
  const track = composition?.tracks.find(item => item.trackId === trackId);
  if (!composition || !track) return <div className="studio studio-state" role={error ? "alert" : "status"}>
    {error ?? "피아노롤을 불러오는 중입니다."}<button onClick={onBack}>돌아가기</button></div>;
  return <LoadedNoteEditor composition={composition} track={track} clipId={clipId}
    onTimingSaved={timing => setComposition(current => current ? { ...current, project: { ...current.project, ...timing } } : current)}
    onBack={onBack} onAddLayer={onAddLayer} onClipSelected={onClipSelected} />;
}

function LoadedNoteEditor({ composition, track, clipId, onTimingSaved, onBack, onAddLayer, onClipSelected }: {
  composition: CompositionDto; track: TrackDto; clipId: number | null; onTimingSaved: (timing: ProjectTimingDto) => void; onBack: () => void; onAddLayer: () => void;
  onClipSelected: (trackId: number, clipId: number | null) => void;
}) {
  const [lengthCells, setLengthCells] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [chordFocus, setChordFocus] = useState<{ pitch: number; startTick: number } | null>(null);
  const instrument = instrumentFor(track.instrument);
  const clip = track.clips.find(item => item.clipId === clipId && item.clipType === "MIDI");
  const editable = composition.project.status !== "COMPLETED" && composition.viewerPermission.canContribute && track.ownerId === composition.viewerPermission.userId
    && (track.approvalStatus === "DRAFT" || track.approvalStatus === "APPROVED")
    && (clipId === null || Boolean(clip && clip.ownerId === composition.viewerPermission.userId
      && (clip.approvalStatus === "DRAFT" || clip.approvalStatus === "APPROVED")));
  const layerCreationAllowed = canCreateLayer(composition.viewerPermission, composition.tracks);
  const stepTick = Math.max(1, Math.round(composition.project.ppq / 2));
  const maxTick = composition.project.maxTick;
  const clipStartTick = clip?.startTick ?? 0;
  const clipStartMs = clipStartTick * 60_000 / (composition.project.bpm * composition.project.ppq);
  const baseClip = useMemo<DraftContent | null>(() => clip ? {
    startTick: clip.startTick, durationTick: clip.durationTick, midiNotes: clip.midiNotes,
  } : null, [clip]);
  const initialContent = useMemo<DraftContent>(() => baseClip ?? { startTick: 0, durationTick: stepTick, midiNotes: [] }, [baseClip, stepTick]);
  const context = useMemo(() => ({ userId: composition.viewerPermission.userId, projectId: composition.project.projectId,
    trackId: track.trackId, targetClipId: clipId }), [composition.viewerPermission.userId, composition.project.projectId, track.trackId, clipId]);
  const onCommittedRecovery = useCallback((id: number) => onClipSelected(track.trackId, id), [onClipSelected, track.trackId]);
  const draft = useEditorDraft({ context, content: initialContent, baseClip, enabled: editable, onCommittedRecovery });
  const notes = draft.state?.content.midiNotes ?? initialContent.midiNotes;
  const canEditNotes = editable && Boolean(draft.session) && !busy && draft.state?.status !== "conflict";
  const setNotes = useCallback<Dispatch<SetStateAction<MidiNoteDto[]>>>((action) => {
    if (!draft.session) return;
    const current = draft.session.getSnapshot().content;
    const next = typeof action === "function" ? action(current.midiNotes) : action;
    draft.session.edit({ startTick: current.startTick,
      durationTick: Math.max(baseClip?.durationTick ?? 0, stepTick, ...next.map(n => n.startTick + n.durationTick)), midiNotes: next });
  }, [draft.session, baseClip, stepTick]);
  const history = useNoteHistory(notes, setNotes, draft.session);
  const preview = useMemo(() => {
    const previewClip = clip ? { ...clip, midiNotes: notes }
      : { clipId: -1, ownerId: composition.viewerPermission.userId, clipType: "MIDI" as const,
        sourceType: "MIDI_INPUT", mediaFileId: null, mediaUrl: null, startTick: 0,
        durationTick: maxTick, startTimeMs: 0, durationMs: composition.project.maxDurationMs,
        clipOffsetMs: 0, approvalStatus: "DRAFT", midiNotes: notes };
    return { ...composition, tracks: [{ ...track, isMuted: false, isSolo: false, clips: [previewClip] }] };
  }, [composition, track, clip, notes, maxTick]);
  const playback = useCompositionPlayback(preview);

  function addChord(rootPitch: number, quality: ChordQuality, name: string) {
    if (!canEditNotes || instrument.kind === "drum") return { added: false, message: "지금은 코드를 추가할 수 없습니다." };
    const startTick = chordStartTick(playback.positionMs, { ...composition.project, stepTick, clipStartTick });
    const result = insertChord(notes, { rootPitch, quality, startTick,
      durationTick: lengthCells * stepTick, maxTick: maxTick - clipStartTick });
    if (result.reason === "overlap") return { added: false, message: "같은 위치에 겹치는 음이 있습니다. 재생 위치를 옮기거나 기존 음을 수정해 주세요." };
    if (result.reason === "outside-timeline") return { added: false, message: "곡의 끝에는 추가할 수 없습니다. 재생 위치를 앞으로 옮겨 주세요." };
    if (result.reason === "outside-pitch-range") return { added: false, message: "음역을 벗어납니다. 옥타브를 낮춰 주세요." };
    playback.pause();
    history.apply(result.notes);
    const added = result.notes.slice(notes.length);
    setChordFocus({ pitch: Math.round((added[0].pitch + added[added.length - 1].pitch) / 2), startTick });
    setError(null);
    return { added: true, message: `${name} 코드의 ${added.length}개 음을 추가했습니다.` };
  }

  async function leave(afterSave = onBack, commit = false) {
    if (busy) return;
    if (!editable) { afterSave(); return; }
    if (!draft.session) return;
    setBusy(true); setError(null); draft.session.freeze(true);
    try {
      if (commit) await draft.commit();
      else await draft.session.flush();
      afterSave();
    } catch (cause) {
      if (!commit && draft.session.getSnapshot().localProtected) afterSave();
      else setError(errorText(cause));
    } finally { draft.session.freeze(false); setBusy(false); }
  }

  async function changeTiming(timing: MusicalTiming) {
    if (!composition.viewerPermission.canExport || composition.project.status === "COMPLETED" || busy) return;
    setBusy(true); playback.seek(0);
    draft.session?.freeze(true);
    try {
      await draft.session?.flush();
      const result = await updateProjectTiming(composition.project.projectId, timing);
      onTimingSaved(result);
    } finally { draft.session?.freeze(false); setBusy(false); }
  }

  function downloadRecovery() {
    if (!draft.session) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft.session.getLocalRecord(), null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `작곡-복구본-${track.trackId}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const statusText = draft.state?.status === "saving" ? "저장 중…"
    : draft.state?.status === "saved" ? "임시 저장됨"
    : draft.state?.status === "local" ? "이 기기에 저장됨 · 서버 저장 재시도"
    : draft.state?.status === "error" ? "임시 저장 실패"
    : draft.state?.status === "conflict" ? "작업 충돌 · 복구본 확인 필요"
    : draft.state?.status === "dirty" ? "변경사항 저장 대기 중" : draft.session ? "자동 저장 사용 중" : "초안 불러오는 중…";
  const initialPitch = notes[0]?.pitch ?? (instrument.kind === "drum" ? 36 : 60);
  return <PianoRollStudio key={draft.state?.draftId ?? "loading"} notes={notes} history={history} editable={canEditNotes}
    ppq={composition.project.ppq} maxTick={maxTick - clipStartTick} bpm={composition.project.bpm}
    timeSignatureNumerator={composition.project.timeSignatureNumerator} timeSignatureDenominator={composition.project.timeSignatureDenominator}
    canEditTiming={composition.viewerPermission.canExport && composition.project.status !== "COMPLETED"}
    onTimingChange={changeTiming}
    positionMs={Math.max(0, playback.positionMs - clipStartMs)} maxDurationMs={composition.project.maxDurationMs - clipStartMs}
    onSeek={ms => playback.seek(ms + clipStartMs)} initialPitch={initialPitch} percussion={instrument.kind === "drum"}
    revealNote={chordFocus} instrument={instrument.label} playing={playback.playing}
    onPlay={() => { void playback.play(); }} onPause={playback.pause} onAudition={pitch => { void playback.audition(pitch, instrument.id); }}
    volume={playback.volume} onVolume={playback.setVolume} onBack={() => { void leave(); }} onSave={() => { void leave(onBack, true); }}
    saveDisabled={!canEditNotes} busy={busy}
    status={<>{editable ? statusText : "읽기 전용"}{draft.restored && draft.state?.status !== "conflict" ? " · 이전 작업 복원됨" : ""}</>}
    actions={<>
      {instrument.kind !== "drum" && <ChordPicker disabled={!canEditNotes} lengthCells={lengthCells}
        onLengthChange={setLengthCells} onOpen={playback.pause} onAdd={addChord} />}
      {layerCreationAllowed && <button className="add-layer" disabled={busy} onClick={() => { void leave(onAddLayer); }}>레이어 추가</button>}
    </>}>
    {editable && <div className="editor-draft-status" role="status" aria-live="polite">
      {draft.session && draft.state?.status !== "idle" && <button disabled={busy} onClick={() => setConfirmDiscard(true)}>초안 버리기</button>}
      {(draft.state?.status === "local" || draft.state?.status === "error") && <button onClick={() => { void draft.session?.flush().catch(cause => setError(errorText(cause))); }}>다시 저장</button>}
      {draft.loadError && <span>{draft.loadError}</span>}
      {!draft.session && draft.loadError && <><button onClick={draft.retryLoad}>다시 불러오기</button><button onClick={onBack}>돌아가기</button></>}
    </div>}
    {confirmDiscard && <div className="editor-draft-conflict" role="dialog" aria-modal="true" aria-labelledby="discard-draft-heading">
      <p id="discard-draft-heading">이 개인 초안의 변경사항을 버릴까요? 이미 레이어에 반영된 노트는 유지됩니다.</p>
      <button disabled={busy} onClick={() => setConfirmDiscard(false)}>취소</button>
      <button disabled={busy} onClick={() => {
        setBusy(true);
        void draft.discard().then(onBack).catch(cause => setError(errorText(cause))).finally(() => setBusy(false));
      }}>초안 버리기</button>
    </div>}
    {draft.state?.status === "conflict" && <div className="editor-draft-conflict" role="alert">
      <p>{draft.state.error}</p>
      <button onClick={downloadRecovery}>내 복구본 다운로드</button>
      <button onClick={() => { void draft.keepLocal().catch(cause => setError(errorText(cause))); }}>내 작업으로 저장</button>
      <button onClick={() => { void draft.useServer().catch(cause => setError(errorText(cause))); }}>서버 작업 불러오기</button>
    </div>}
    {error && <p className="studio-error" role="alert">{error}</p>}
    {playback.error && !error && <p className="studio-error" role="alert">{playback.error}</p>}
    {!editable && <p className="studio-error">본인의 편집 가능한 MIDI만 수정할 수 있습니다.</p>}
  </PianoRollStudio>;
}

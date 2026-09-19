"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { prepareAudioFile } from "@/features/composition/prepare-audio-file";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import { hasOwnDraftClip, shouldShowContributionSubmit } from "@/features/composition/contribution-session";
import { TeamPianoRoll } from "@/features/composition/team-piano-roll";
import { createAudioClip, createDraftProject, createMidiClip, enterComposition, getComposition, getExport, getPendingContributions, publishComposition, reviewContribution, saveMidiClip, submitContribution, updateProjectMetadata, uploadMedia, type CompositionDto, type MidiNoteDto } from "@/lib/api/composition";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
const clockTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const subscribeToDraft = () => () => {};
const storedDraftId = () => {
  const value = Number(window.localStorage.getItem("glitched-composition-draft-id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

function StudioToolbar({ title, bpm, playing, positionMs, maxMs, onPlay, onPause, onSeek, onBack, children, piano, volume, onVolume, onAdd }: {
  title: string; bpm: number; playing: boolean; positionMs: number; maxMs: number;
  onPlay: () => void; onPause: () => void; onSeek: (ms: number) => void; onBack: () => void; children?: React.ReactNode;
  piano?: boolean; volume?: number; onVolume?: (value: number) => void; onAdd?: () => void;
}) {
  return <div className={`studio-toolbar ${piano ? "team-original-toolbar" : ""}`}>
    <button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button>
    <button onClick={playing ? onPause : onPlay} aria-label={playing ? "일시정지" : "재생"} className={playing ? "is-playing" : ""}><Asset name="play.svg" /></button>
    {piano && <Asset name="metronome.svg" />}
    {!piano && <strong className="studio-title">{title}</strong>}
    <span><small>bpm</small>{bpm}</span>
    {piano && <span><small>beat</small>4/4</span>}
    <span><small>time</small>{clockTime(positionMs)}</span>
    {piano ? <div className="studio-volume"><Asset name="sound.svg" /><input type="range" min={0} max={100} value={volume ?? 20} onChange={(event) => onVolume?.(Number(event.target.value))} aria-label="볼륨" /></div>
      : <input className="studio-seek" type="range" min={0} max={maxMs || 1} value={Math.min(positionMs, maxMs || 1)} onChange={(event) => onSeek(Number(event.target.value))} aria-label="재생 위치" />}
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
    <StudioToolbar title="새 곡" bpm={120} playing={false} positionMs={0} maxMs={0} onPlay={() => {}} onPause={() => {}} onSeek={() => {}} onBack={onBack} />
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
        if (result.status === "COMPLETED") {
          setStatus("숏폼 음원이 갱신되었습니다.");
          if (shortId == null) window.localStorage.removeItem("glitched-composition-draft-id");
          await refresh(); return;
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
  const canSubmit = shouldShowContributionSubmit(shortId, viewerPermission, tracks);
  return <div className="studio">
    <StudioToolbar title={project.title} bpm={project.bpm} playing={playback.playing} positionMs={playback.positionMs} maxMs={project.maxDurationMs}
      onPlay={() => { void playback.play(); }} onPause={playback.pause} onSeek={playback.seek}
      onBack={() => returnToNotifications ? go("notifications") : shortId == null ? go("home") : onReturnToShort(shortId)}>
      {canSubmit ? <button className="studio-submit" onClick={() => { setError(null); setShowSubmitForm(true); }} disabled={busy}>제출하기</button>
        : <button className="studio-add" onClick={onAddLayer} disabled={!viewerPermission.canContribute} aria-label="레이어 추가"><i /></button>}
    </StudioToolbar>
    {error && !showSubmitForm && <p className="studio-error" role="alert">{error}</p>}
    {(viewerPermission.canExport && (project.status === "DRAFT" || hasDraftClip) || status) && <div className="studio-workflow">
      {viewerPermission.canExport && (project.status === "DRAFT" || hasDraftClip) && <button onClick={requestPublish} disabled={busy}>{project.status === "DRAFT" ? "곡 올리기" : "내 변경 반영"}</button>}
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
        <div className="track-person"><strong title={track.name}>{track.name}</strong><small>{track.instrument ? "MIDI" : "오디오"}</small></div>
        <div className="studio-track-clips">{track.clips.map((clip) => <button key={clip.clipId} className={`studio-clip ${clip.clipType === "MIDI" ? "midi" : "audio"}`}
          style={{ left: `${clip.startTick / project.maxTick * 100}%`, width: `${Math.max(4, clip.durationTick / project.maxTick * 100)}%` }}
          onClick={() => { if (clip.clipType === "MIDI") onEditTrack(track.trackId, clip.clipId); }}
          aria-label={`${track.name} ${clip.clipType === "MIDI" ? "MIDI 편집" : "오디오 클립"}`}>
          {clip.clipType === "MIDI" ? `${clip.midiNotes?.length ?? 0} notes` : "Audio"}
        </button>)}</div>
        <div className="studio-track-actions">
          {track.instrument && <button onClick={() => onEditTrack(track.trackId, null)}>+ 노트</button>}
          <label className="studio-upload">+ 파일<input type="file" accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac" disabled={busy || !viewerPermission.canContribute}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) setPendingAudio({ trackId: track.trackId, file, url: URL.createObjectURL(file) }); event.target.value = ""; }} /></label>
        </div>
      </div>)}
    </div></div>
  </div>;
}
export function NoteEditorScreen({ projectId, trackId, clipId, onBack, onAddLayer }: {
  projectId: number | null; trackId: number | null; clipId: number | null; onBack: () => void; onAddLayer: () => void;
}) {
  const [composition, setComposition] = useState<CompositionDto | null>(null);
  const [notes, setNotes] = useState<MidiNoteDto[]>([]);
  const [lengthCells, setLengthCells] = useState(1);
  const [initialPitch, setInitialPitch] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const track = composition?.tracks.find((item) => item.trackId === trackId);
  const clip = track?.clips.find((item) => item.clipId === clipId && item.clipType === "MIDI");
  const editable = Boolean(composition && track && (clip ? clip.ownerId === composition.viewerPermission.userId : composition.viewerPermission.canContribute));
  const stepTick = composition ? Math.max(1, Math.round(composition.project.ppq / 2)) : 240;
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
      afterSave();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (!composition || !track) return <div className="studio studio-state" role={error ? "alert" : "status"}>{error ?? "피아노롤을 불러오는 중입니다."}<button onClick={onBack}>돌아가기</button></div>;
  return <div className="studio note-editor">
    <StudioToolbar title={`${track.name} · 피아노롤`} bpm={composition.project.bpm} playing={playback.playing} positionMs={playback.positionMs} maxMs={composition.project.maxDurationMs}
      onPlay={() => { void playback.play(); }} onPause={playback.pause} onSeek={playback.seek} onBack={onBack}
      piano volume={playback.volume} onVolume={playback.setVolume} onAdd={() => { if (editable) void save(onAddLayer); else onAddLayer(); }}>
      <label className="studio-note-length">길이<select value={lengthCells} onChange={(event) => setLengthCells(Number(event.target.value))}><option value={1}>1/8</option><option value={2}>1/4</option><option value={4}>1/2</option><option value={8}>한 마디</option></select></label>
      <button className="studio-save" onClick={() => { void save(); }} disabled={!editable || busy}>{busy ? "저장 중" : "저장"}</button>
    </StudioToolbar>
    {error && <p className="studio-error" role="alert">{error}</p>}
    {!editable && <p className="studio-error">다른 참여자의 MIDI는 수정할 수 없습니다. 새 클립을 만들어 주세요.</p>}
    <TeamPianoRoll notes={notes} setNotes={setNotes} stepTick={stepTick}
      maxTick={maxTick - clipStartTick} lengthCells={lengthCells} editable={editable}
      positionMs={playback.positionMs} maxDurationMs={composition.project.maxDurationMs}
      onSeek={playback.seek} initialPitch={initialPitch} />
  </div>;
}

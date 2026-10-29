"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { prepareAudioFile } from "@/features/composition/prepare-audio-file";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import { canCreateLayer, hasOwnDraftClip, shouldShowContributionSubmit } from "@/features/composition/contribution-session";
import { completedExportShortId } from "@/features/composition/publish-navigation";
import { TeamPianoRoll } from "@/features/composition/team-piano-roll";
import { ChordPicker } from "@/features/composition/chord-picker";
import { chordStartTick, insertChord, type ChordQuality } from "@/features/composition/chord-input";
import { instrumentFor } from "@/features/composition/instrument-catalog";
import { createAudioClip, createDraftProject, enterComposition, getComposition, getExport, getPendingContributions, publishComposition, reviewContribution, submitContribution, updateProjectMetadata, uploadMedia, type CompositionDto, type MidiNoteDto, type TrackDto } from "@/lib/api/composition";

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
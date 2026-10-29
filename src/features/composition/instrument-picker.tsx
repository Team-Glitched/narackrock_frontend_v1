"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Headphones, X } from "lucide-react";
import { getComposition } from "@/lib/api/composition";
import { instrumentGroups, instrumentParts, occupyingTrack, partLabel, supportsMidi, type PartTrack } from "./instrument-parts";

export function InstrumentPicker({ projectId, currentTrackId, currentInstrument, mode = "midi", midiOnly = false, onPreview, onStop,
  onConfirm, onClose, audio }: {
  projectId: number; currentTrackId?: number; currentInstrument?: string | null; mode?: "midi" | "audio"; midiOnly?: boolean;
  onPreview: (id: string) => Promise<void>; onStop: () => void; onConfirm: (id: string) => Promise<void>; onClose: () => void;
  audio?: { url: string; startMs: number; endMs?: number };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const source = useRef<HTMLAudioElement>(null);
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const titleId = useId();
  const [candidate, setCandidate] = useState(currentInstrument ?? "");
  const [tracks, setTracks] = useState<PartTrack[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSound, setLoadingSound] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  const groups = instrumentGroups.filter(group => (mode === "audio" && !midiOnly) || group.instruments.some(supportsMidi));
  useEffect(() => {
    dialog.current?.showModal();
    const originalAudio = source.current;
    let alive = true;
    void getComposition(projectId).then(result => { if (alive) setTracks(result.tracks); })
      .catch(() => { if (alive) setError("팀원 악기를 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요."); });
    return () => { alive = false; originalAudio?.pause(); onStop(); };
  }, [projectId, onStop]);
  function close() { if (!saving) { onStop(); source.current?.pause(); onClose(); } }
  async function preview(id: string) {
    setCandidate(id); setError(""); setLoadingSound(id);
    const next = ++request.current;
    onStop(); source.current?.pause();
    try {
      if (mode === "audio" && source.current && audio) {
        source.current.currentTime = audio.startMs / 1000;
        await source.current.play();
      } else if (mode === "midi") await onPreview(id);
    } catch { if (next === request.current && dialog.current?.open) setError("미리 듣기를 재생하지 못했어요. 악기는 선택할 수 있습니다."); }
    finally { if (next === request.current && dialog.current?.open) setLoadingSound(""); }
  }
  async function confirm() {
    if (!tracks || !candidate || saving || occupyingTrack(tracks, candidate, currentTrackId)) return;
    setSaving(true); setError(""); onStop(); source.current?.pause();
    try { await onConfirm(candidate); onClose(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "악기를 선택하지 못했습니다.");
      try { setTracks((await getComposition(projectId)).tracks); } catch { setTracks(null); }
    } finally { setSaving(false); }
  }
  const occupied = tracks && candidate ? occupyingTrack(tracks, candidate, currentTrackId) : undefined;
  return <dialog className="instrument-dialog" ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <header className="instrument-dialog-heading"><div><h2 id={titleId}>{mode === "midi" ? "악기 고르기" : "어떤 소리를 담았나요?"}</h2>
      <p>{mode === "midi" ? "음색을 눌러 예시 소리를 듣고, 선택 버튼으로 확정하세요." : "담당한 악기나 보컬을 골라 주세요. 녹음한 소리는 그대로 유지됩니다."}</p></div>
      <button type="button" aria-label="악기 선택 닫기" onClick={close} disabled={saving}><X /></button></header>
    <nav className="instrument-family-navigation" aria-label="악기 종류 바로가기">{groups.map(group =>
      <button type="button" key={group.id} onClick={() => headings.current.get(group.id)?.scrollIntoView({ block: "start" })}>{group.label}</button>)}</nav>
    <div className="instrument-group-list">{!tracks && <p role="status">{error ? "사용 현황 확인이 필요해요." : "팀원들의 악기를 확인하고 있어요…"}</p>}
      {groups.map(group => {
        const occupant = tracks && occupyingTrack(tracks, group.instruments[0], currentTrackId);
        return <section className="instrument-family" key={group.id} aria-label={`${group.label} 종류`}>
          <h3 ref={element => { if (element) headings.current.set(group.id, element); }} tabIndex={-1}>{group.label}
            {occupant && <span>팀원 사용 중 · {occupant.name}</span>}</h3>
          <div className="instrument-options">{group.instruments.filter(id => (mode === "audio" && !midiOnly) || supportsMidi(id)).map(id =>
            <button type="button" key={id} className={candidate === id ? "selected" : ""} aria-pressed={candidate === id}
              aria-label={`${partLabel(id)}${mode === "midi" ? " 미리 듣기" : " 역할 선택"}`}
              disabled={!tracks || saving || Boolean(occupant)} onClick={() => { void preview(id); }}>
              <Headphones aria-hidden="true" /><span>{instrumentParts.find(part => part.id === id)?.label ?? id}
                <small>{occupant ? "이미 선택된 종류" : loadingSound === id ? "소리 준비 중…" : mode === "midi" ? "눌러서 미리 듣기" : "원본 소리로 확인"}</small></span>
              {candidate === id && <Check aria-hidden="true" />}
            </button>)}</div>
        </section>;
      })}</div>
    {audio && <audio ref={source} src={audio.url} preload="metadata" onTimeUpdate={event => {
      if (audio.endMs && event.currentTarget.currentTime * 1000 >= audio.endMs) event.currentTarget.pause();
    }} />}
    {error && <p className="instrument-picker-error" role="alert">{error}</p>}
    <footer className="instrument-dialog-footer"><span>{candidate ? partLabel(candidate) : "악기를 골라 주세요"}</span>
      <button type="button" disabled={!tracks || !candidate || saving || Boolean(occupied)} onClick={() => { void confirm(); }}>
        {saving ? "저장 중…" : mode === "midi" ? "이 악기로 선택" : "이 역할로 저장"}</button></footer>
  </dialog>;
}

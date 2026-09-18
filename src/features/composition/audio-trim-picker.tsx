"use client";

import { useRef, useState } from "react";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";

const maxClipMs = 60_000;
const formatTime = (ms: number) => `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor(ms % 1000 / 100)}`;

export function AudioTrimPicker({ url, onSave, onCancel, saveLabel }: {
  url: string;
  onSave: (selection: AudioSelection) => Promise<void>;
  onCancel?: () => void;
  saveLabel: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [selection, setSelection] = useState<AudioSelection | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const minimumMs = Math.min(100, durationMs ?? 100);
  function changeStart(value: number) {
    if (durationMs == null) return;
    const startMs = Math.max(0, Math.min(durationMs - minimumMs, Math.round(value / 100) * 100));
    setSelection((current) => {
      const lengthMs = current ? current.endMs - current.startMs : Math.min(durationMs, maxClipMs);
      return { startMs, endMs: Math.min(durationMs, startMs + Math.max(minimumMs, Math.min(lengthMs, maxClipMs))) };
    });
  }
  function changeEnd(value: number) {
    if (durationMs == null) return;
    setSelection((current) => {
      if (!current) return null;
      return { ...current, endMs: Math.max(current.startMs + minimumMs,
        Math.min(durationMs, current.startMs + maxClipMs, Math.round(value / 100) * 100)) };
    });
  }

  async function preview() {
    const audio = audioRef.current;
    if (!audio || !selection) return;
    audio.currentTime = selection.startMs / 1000;
    setPreviewing(true);
    try { await audio.play(); }
    catch { setPreviewing(false); setError("선택 구간을 재생하지 못했습니다."); }
  }
  async function save() {
    if (!selection || busy) return;
    setBusy(true); setError("");
    try { await onSave(selection); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "파일을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="audio-trim-picker">
    <audio ref={audioRef} controls src={url} preload="metadata"
      onLoadedMetadata={(event) => {
        const seconds = event.currentTarget.duration;
        if (!Number.isFinite(seconds) || seconds <= 0) { setError("오디오 길이를 읽을 수 없습니다."); return; }
        const total = Math.floor(seconds * 1000);
        setDurationMs(total);
        setSelection({ startMs: 0, endMs: Math.min(total, maxClipMs) });
      }}
      onError={() => { if (url) setError("이 오디오 파일을 읽을 수 없습니다."); }}
      onTimeUpdate={(event) => {
        if (previewing && selection && event.currentTarget.currentTime * 1000 >= selection.endMs) {
          event.currentTarget.pause(); setPreviewing(false);
        }
      }}
      onPause={() => setPreviewing(false)} />
    {durationMs != null && selection ? <>
      <p>원본 {formatTime(durationMs)} · 저장 구간 {formatTime(selection.endMs - selection.startMs)} (최대 1분)</p>
      <label>시작 <strong>{formatTime(selection.startMs)}</strong>
        <input type="range" min={0} max={Math.max(0, durationMs - minimumMs)} step={100}
          value={selection.startMs} onChange={(event) => changeStart(Number(event.target.value))} aria-label="저장 시작 위치" />
      </label>
      <label>끝 <strong>{formatTime(selection.endMs)}</strong>
        <input type="range" min={selection.startMs + minimumMs} max={Math.min(durationMs, selection.startMs + maxClipMs)} step={100}
          value={selection.endMs} onChange={(event) => changeEnd(Number(event.target.value))} aria-label="저장 종료 위치" />
      </label>
      <div className="audio-trim-markers">
        <button type="button" onClick={() => changeStart((audioRef.current?.currentTime ?? 0) * 1000)}>현재 위치를 시작으로</button>
        <button type="button" onClick={() => changeEnd((audioRef.current?.currentTime ?? 0) * 1000)}>현재 위치를 끝으로</button>
      </div>
      <button type="button" className="audio-trim-preview" onClick={() => { void preview(); }}>선택 구간 미리 듣기</button>
    </> : <p role="status">오디오 길이를 읽는 중입니다.</p>}
    {error && <p className="audio-trim-error" role="alert">{error}</p>}
    <div className="audio-trim-actions">
      {onCancel && <button type="button" onClick={onCancel} disabled={busy}>취소</button>}
      <button type="button" className="purple-pill" onClick={() => { void save(); }} disabled={!selection || busy}>
        {busy ? "올리는 중..." : saveLabel}
      </button>
    </div>
  </div>;
}

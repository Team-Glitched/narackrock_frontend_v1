import { studioStyles } from "@/styles/studio.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { pointerAxes, logicalBounds } from "./pointer-coordinates";
import { waveformPeaks } from "./waveform-peaks";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LoaderCircle } from "lucide-react";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import {
  centerAudioSelection,
  maxAudioClipMs,
  moveAudioSelection,
  resizeAudioSelectionEnd,
  resizeAudioSelectionStart,
} from "@/features/composition/audio-trim-selection";

const waveformBars = 96;
const formatTime = (ms: number) =>
  `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
type DragMode = "move" | "start" | "end";
type WaveformResult = { url: string; peaks: number[] | null };

function AudioTrimLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-caption">
      <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function AudioTrimPicker({
  url,
  onSave,
  onCancel,
  saveLabel,
}: {
  url: string;
  onSave: (selection: AudioSelection) => Promise<void>;
  onCancel?: () => void;
  saveLabel: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; clientX: number; selection: AudioSelection } | null>(
    null,
  );
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [selection, setSelection] = useState<AudioSelection | null>(null);
  const [waveformResult, setWaveformResult] = useState<WaveformResult | null>(null);
  const waveform = waveformResult?.url === url ? waveformResult : null;
  const [currentMs, setCurrentMs] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadWaveform() {
      let context: AudioContext | undefined;
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error("오디오 파일을 읽을 수 없습니다.");
        const data = await response.arrayBuffer();
        if (signal.aborted) return;
        context = new AudioContext();
        const buffer = await context.decodeAudioData(data);
        if (!signal.aborted)
          setWaveformResult({
            url,
            peaks: waveformPeaks(buffer, waveformBars).map((peak) => Math.max(0.12, peak)),
          });
      } catch {
        if (!signal.aborted) setWaveformResult({ url, peaks: null });
      } finally {
        if (context) void context.close();
      }
    }

    void loadWaveform();
    return () => controller.abort();
  }, [url]);

  function stopPreview() {
    audioRef.current?.pause();
    setPreviewing(false);
  }
  function applySelection(next: AudioSelection) {
    stopPreview();
    setSelection(next);
    setCurrentMs(next.startMs);
    if (audioRef.current) audioRef.current.currentTime = next.startMs / 1000;
  }
  function pointerRatio(clientX: number) {
    const rect = waveformRef.current ? logicalBounds(waveformRef.current) : null;
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }
  function startDrag(event: ReactPointerEvent, mode: DragMode) {
    if (!selection) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode, clientX: pointerAxes(event.currentTarget, event).x, selection };
  }
  function drag(event: ReactPointerEvent) {
    const state = dragRef.current;
    const rect = waveformRef.current ? logicalBounds(waveformRef.current) : null;
    if (!state || !durationMs || !rect) return;
    const deltaMs =
      ((pointerAxes(event.currentTarget, event).x - state.clientX) / rect.width) * durationMs;
    const next =
      state.mode === "move"
        ? moveAudioSelection(state.selection, deltaMs, durationMs)
        : state.mode === "start"
          ? resizeAudioSelectionStart(state.selection, state.selection.startMs + deltaMs)
          : resizeAudioSelectionEnd(state.selection, state.selection.endMs + deltaMs, durationMs);
    applySelection(next);
  }
  function finishDrag() {
    dragRef.current = null;
  }
  function nudgeHandle(handle: "start" | "end", direction: number) {
    if (!selection || !durationMs) return;
    applySelection(
      handle === "start"
        ? resizeAudioSelectionStart(selection, selection.startMs + direction * 100)
        : resizeAudioSelectionEnd(selection, selection.endMs + direction * 100, durationMs),
    );
  }

  async function togglePreview() {
    const audio = audioRef.current;
    if (!audio || !selection) return;
    if (previewing) {
      stopPreview();
      return;
    }
    if (
      audio.currentTime * 1000 < selection.startMs ||
      audio.currentTime * 1000 >= selection.endMs - 100
    ) {
      audio.currentTime = selection.startMs / 1000;
      setCurrentMs(selection.startMs);
    }
    setPreviewing(true);
    setError("");
    try {
      await audio.play();
    } catch {
      setPreviewing(false);
      setError("선택 구간을 재생하지 못했습니다.");
    }
  }
  async function save() {
    if (!selection || busy) return;
    setBusy(true);
    setError("");
    stopPreview();
    try {
      await onSave(selection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "파일을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const startPercent = durationMs && selection ? (selection.startMs / durationMs) * 100 : 0;
  const endPercent = durationMs && selection ? (selection.endMs / durationMs) * 100 : 0;
  return (
    <div className={studioStyles.audioTrimPicker}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const seconds = event.currentTarget.duration;
          if (!Number.isFinite(seconds) || seconds <= 0) {
            setError("오디오 길이를 읽을 수 없습니다.");
            return;
          }
          const total = Math.floor(seconds * 1000);
          const initial = { startMs: 0, endMs: Math.min(total, maxAudioClipMs) };
          setDurationMs(total);
          setSelection(initial);
          setCurrentMs(0);
        }}
        onError={() => {
          if (url) setError("이 오디오 파일을 읽을 수 없습니다.");
        }}
        onTimeUpdate={(event) => {
          const next = event.currentTarget.currentTime * 1000;
          setCurrentMs(next);
          if (previewing && selection && next >= selection.endMs) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = selection.endMs / 1000;
            setCurrentMs(selection.endMs);
            setPreviewing(false);
          }
        }}
        onEnded={() => setPreviewing(false)}
        onPause={() => setPreviewing(false)}
      />
      {durationMs != null && selection ? (
        <>
          <div className={studioStyles.audioTrimSummary}>
            <span>
              <strong>{formatTime(selection.endMs - selection.startMs)}</strong> 선택
            </span>
            <span>
              {formatTime(selection.startMs)} – {formatTime(selection.endMs)}
            </span>
          </div>
          <div className={sharedStyles.audioPreviewRow}>
            <button
              type="button"
              className={sharedStyles.audioPreviewToggle}
              onClick={() => {
                void togglePreview();
              }}
              aria-label={previewing ? "미리 듣기 정지" : "선택 구간 미리 듣기"}
            >
              {previewing ? "■" : "▶"}
            </button>
            <span>
              {formatTime(Math.max(selection.startMs, Math.min(currentMs, selection.endMs)))}
            </span>
            <input
              type="range"
              min={selection.startMs}
              max={selection.endMs}
              step={100}
              value={Math.max(selection.startMs, Math.min(currentMs, selection.endMs))}
              aria-label="미리 듣기 위치"
              onChange={(event) => {
                const value = Number(event.target.value);
                stopPreview();
                setCurrentMs(value);
                if (audioRef.current) audioRef.current.currentTime = value / 1000;
              }}
            />
          </div>
          <p className={studioStyles.audioTrimGuide}>
            선택 영역을 움직이거나 양쪽 손잡이로 길이를 조절하세요. 최대 1분까지 저장할 수 있습니다.
          </p>
          <div
            ref={waveformRef}
            className={sharedStyles.audioWaveform}
            aria-label="오디오 구간 선택 파형"
            onPointerDown={(event) =>
              applySelection(
                centerAudioSelection(
                  selection,
                  pointerRatio(pointerAxes(event.currentTarget, event).x) * durationMs,
                  durationMs,
                ),
              )
            }
          >
            {waveform?.peaks ? (
              <div className={sharedStyles.audioWaveformBars} aria-hidden="true">
                {waveform.peaks.map((peak, index) => (
                  <i key={index} style={{ height: `${Math.round(peak * 82)}%` }} />
                ))}
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-0 z-[3] grid place-items-center">
                {waveform ? (
                  <p role="status" className="text-caption">
                    파형을 표시할 수 없습니다.
                  </p>
                ) : (
                  <AudioTrimLoading label="파형을 계산하는 중입니다." />
                )}
              </div>
            )}
            <div
              className={cn(sharedStyles.audioWaveformShade, sharedStyles.left)}
              style={{ width: `${startPercent}%` }}
            />
            <div
              className={cn(sharedStyles.audioWaveformShade, sharedStyles.right)}
              style={{ left: `${endPercent}%` }}
            />
            <div
              className={sharedStyles.audioWaveformSelection}
              style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
              onPointerDown={(event) => startDrag(event, "move")}
              onPointerMove={drag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <button
                type="button"
                className={cn(studioStyles.audioTrimHandle, sharedStyles.start)}
                aria-label="시작 위치 조절"
                onPointerDown={(event) => startDrag(event, "start")}
                onPointerMove={drag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    nudgeHandle("start", event.key === "ArrowLeft" ? -1 : 1);
                  }
                }}
              />
              <button
                type="button"
                className={cn(studioStyles.audioTrimHandle, sharedStyles.end)}
                aria-label="종료 위치 조절"
                onPointerDown={(event) => startDrag(event, "end")}
                onPointerMove={drag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    nudgeHandle("end", event.key === "ArrowLeft" ? -1 : 1);
                  }
                }}
              />
            </div>
          </div>
          <div className={sharedStyles.audioWaveformTimes}>
            <span>00:00.0</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </>
      ) : error ? null : (
        <AudioTrimLoading label="오디오 길이를 읽는 중입니다." />
      )}
      {error && (
        <p className={studioStyles.audioTrimError} role="alert">
          {error}
        </p>
      )}
      <div className={studioStyles.audioTrimActions}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}>
            취소
          </button>
        )}
        <button
          type="button"
          className={buttonVariants({
            tone: "primary",
          })}
          onClick={() => {
            void save();
          }}
          disabled={!selection || busy}
        >
          {busy ? "올리는 중..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

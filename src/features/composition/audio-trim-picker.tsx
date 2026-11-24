import { studioStyles } from "@/styles/studio.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { pointerAxes, logicalBounds } from "./pointer-coordinates";
import { waveformPeaks } from "./waveform-peaks";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
} from "lucide-react";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import {
  centerAudioSelection,
  maxAudioClipMs,
  minAudioClipMs,
} from "@/features/composition/audio-trim-selection";
import {
  beatMarksForDuration,
  createInitialSegments,
  deleteSegmentAt,
  duplicateSegmentAt,
  moveSegmentOrder,
  moveSegmentWindow,
  resizeSegmentEnd,
  resizeSegmentStart,
  selectionFromSegments,
  splitSegmentAt,
  splicedTimelinePosition,
  totalSegmentsMs,
  type SpliceSegment,
} from "@/features/composition/audio-splice";
import { defaultSignature, type TimeSignature } from "@/features/composition/time-signature";

const waveformBars = 96;
export const formatTrimTime = (ms: number) =>
  `${String(Math.floor(Math.max(0, ms) / 60_000)).padStart(2, "0")}:${String(
    Math.floor(Math.max(0, ms) / 1000) % 60,
  ).padStart(2, "0")}.${Math.floor((Math.max(0, ms) % 1000) / 100)}`;
const formatTime = formatTrimTime;
type DragMode = "move" | "start" | "end";
type WaveformResult = { url: string; peaks: number[] | null; buffer: AudioBuffer | null };

function AudioTrimLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-caption text-app-muted">
      <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Complement intervals in `[0, durationMs]` not covered by any active segment (for dark dimming). */
function computeDimmedGaps(
  segments: readonly { startMs: number; endMs: number }[],
  durationMs: number,
): { startMs: number; endMs: number }[] {
  if (!segments.length || durationMs <= 0) return [{ startMs: 0, endMs: Math.max(0, durationMs) }];
  const sorted = [...segments]
    .map((s) => ({
      startMs: Math.max(0, Math.min(durationMs, s.startMs)),
      endMs: Math.max(0, Math.min(durationMs, s.endMs)),
    }))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  if (!sorted.length) return [{ startMs: 0, endMs: durationMs }];
  const merged: { startMs: number; endMs: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    if (sorted[i].startMs <= prev.endMs) prev.endMs = Math.max(prev.endMs, sorted[i].endMs);
    else merged.push(sorted[i]);
  }
  const gaps: { startMs: number; endMs: number }[] = [];
  let cursor = 0;
  for (const seg of merged) {
    if (seg.startMs > cursor) gaps.push({ startMs: cursor, endMs: seg.startMs });
    cursor = Math.max(cursor, seg.endMs);
  }
  if (cursor < durationMs) gaps.push({ startMs: cursor, endMs: durationMs });
  return gaps;
}

/**
 * Length, waveform, multi-segment splicing, selection and saving of the audio trim picker,
 * shared by the web picker and the app's native trim (native-audio-trim.tsx).
 */
export function useAudioTrim(
  url: string | null,
  onSave: (selection: AudioSelection) => Promise<void>,
  stopPreview: () => void,
) {
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [segments, setSegments] = useState<SpliceSegment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<SpliceSegment[][]>([]);
  const [waveformResult, setWaveformResult] = useState<WaveformResult | null>(null);
  const waveform = waveformResult?.url === url ? waveformResult : null;
  const [currentMs, setCurrentMs] = useState(0);
  const [cursorSourceMs, setCursorSourceMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedUrl, setLoadedUrl] = useState(url);
  const idCounterRef = useRef(2);
  const durationRef = useRef<number | null>(null);
  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  if (loadedUrl !== url) {
    setLoadedUrl(url);
    setDurationMs(null);
    setSegments([]);
    setSelectedIndex(0);
    setUndoStack([]);
    setCurrentMs(0);
    setCursorSourceMs(0);
    setError("");
  }

  const nextSegId = useCallback(() => {
    const id = `seg-${idCounterRef.current}`;
    idCounterRef.current += 1;
    return id;
  }, []);

  const initializeFromDuration = useCallback((totalMs: number) => {
    const initial = createInitialSegments(totalMs);
    setDurationMs(totalMs);
    setSegments(initial);
    setSelectedIndex(0);
    setUndoStack([]);
    setCurrentMs(0);
    setCursorSourceMs(initial[0]?.startMs ?? 0);
    setError("");
  }, []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function loadWaveform(targetUrl: string) {
      let context: AudioContext | undefined;
      try {
        const response = await fetch(targetUrl, { signal });
        if (!response.ok) throw new Error("오디오 파일을 읽을 수 없습니다.");
        const data = await response.arrayBuffer();
        if (signal.aborted) return;
        context = new AudioContext();
        const buffer = await context.decodeAudioData(data);
        if (signal.aborted) return;
        const peaks = waveformPeaks(buffer, waveformBars).map((peak) => Math.max(0.12, peak));
        setWaveformResult({ url: targetUrl, peaks, buffer });
        // MediaRecorder WebM blobs in Chromium often report Infinity for `<audio>.duration`.
        if (durationRef.current === null && Number.isFinite(buffer.duration) && buffer.duration > 0) {
          initializeFromDuration(Math.floor(buffer.duration * 1000));
        }
      } catch {
        if (!signal.aborted) {
          setWaveformResult({ url: targetUrl, peaks: null, buffer: null });
          if (durationRef.current === null) {
            setError("오디오 길이를 읽을 수 없습니다.");
          }
        }
      } finally {
        if (context) void context.close();
      }
    }

    void loadWaveform(url);
    return () => controller.abort();
  }, [url, initializeFromDuration]);

  const metadata = {
    onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => {
      const seconds = event.currentTarget.duration;
      if (!Number.isFinite(seconds) || seconds <= 0) {
        // Wait for Web Audio decodeAudioData (handles WebM blobs whose metadata duration is Infinity).
        return;
      }
      if (durationRef.current === null) {
        initializeFromDuration(Math.floor(seconds * 1000));
      }
    },
    onError: () => {
      if (url && durationRef.current === null) {
        setError("이 오디오 파일을 읽을 수 없습니다.");
      }
    },
  };

  const selection = useMemo<AudioSelection | null>(
    () => (segments.length ? selectionFromSegments(segments) : null),
    [segments],
  );
  const totalMs = useMemo(() => totalSegmentsMs(segments), [segments]);
  const edited = useMemo(() => {
    if (!durationMs || !segments.length) return false;
    if (segments.length > 1) return true;
    const expectedEnd = Math.min(durationMs, maxAudioClipMs);
    return segments[0].startMs !== 0 || segments[0].endMs !== expectedEnd;
  }, [durationMs, segments]);

  const applySegments = useCallback(
    (
      nextSegments: SpliceSegment[],
      nextSelected = selectedIndex,
      options?: { pushUndo?: boolean; cursorMs?: number },
    ) => {
      stopPreview();
      if (options?.pushUndo && segments.length) {
        setUndoStack((prev) => [...prev.slice(-19), segments]);
      }
      const clampedIndex = Math.max(0, Math.min(nextSegments.length - 1, nextSelected));
      setSegments(nextSegments);
      setSelectedIndex(clampedIndex);
      setCurrentMs(0);
      setCursorSourceMs(
        options?.cursorMs ?? nextSegments[clampedIndex]?.startMs ?? nextSegments[0]?.startMs ?? 0,
      );
      setError("");
    },
    [selectedIndex, segments, stopPreview],
  );

  /** Updates the active segment (or replaces segments when provided). */
  const select = useCallback(
    (next: AudioSelection, options?: { pushUndo?: boolean }) => {
      stopPreview();
      if (options?.pushUndo && segments.length) {
        setUndoStack((prev) => [...prev.slice(-19), segments]);
      }
      if (next.segments?.length) {
        const mapped: SpliceSegment[] = next.segments.map((seg, idx) => ({
          id: segments[idx]?.id ?? nextSegId(),
          startMs: seg.startMs,
          endMs: seg.endMs,
        }));
        setSegments(mapped);
        const clamped = Math.max(0, Math.min(mapped.length - 1, selectedIndex));
        setSelectedIndex(clamped);
        setCurrentMs(0);
        setCursorSourceMs(mapped[clamped]?.startMs ?? 0);
        return;
      }
      if (segments.length <= 1) {
        const updated: SpliceSegment = {
          id: segments[0]?.id ?? "seg-1",
          startMs: next.startMs,
          endMs: next.endMs,
        };
        setSegments([updated]);
        setSelectedIndex(0);
        setCurrentMs(0);
        setCursorSourceMs(next.startMs);
      } else {
        const idx = Math.max(0, Math.min(segments.length - 1, selectedIndex));
        const nextList = segments.map((seg, i) =>
          i === idx ? { ...seg, startMs: next.startMs, endMs: next.endMs } : seg,
        );
        setSegments(nextList);
        setCurrentMs(0);
        setCursorSourceMs(next.startMs);
      }
    },
    [nextSegId, segments, selectedIndex, stopPreview],
  );

  const selectSegment = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) return;
      stopPreview();
      setSelectedIndex(index);
      setCursorSourceMs(segments[index].startMs);
      let elapsedBefore = 0;
      for (let i = 0; i < index; i += 1) {
        elapsedBefore += segments[i].endMs - segments[i].startMs;
      }
      setCurrentMs(elapsedBefore);
    },
    [segments, stopPreview],
  );

  const splitAtCursor = useCallback(
    (atMs = cursorSourceMs) => {
      const result = splitSegmentAt(segments, atMs, nextSegId(), selectedIndex);
      if (!result) {
        setError(`양쪽 조각이 최소 ${(minAudioClipMs / 1000).toFixed(1)}초 이상이 되도록 파형 안쪽을 선택해 주세요.`);
        return false;
      }
      applySegments(result.segments, result.selectedIndex, {
        pushUndo: true,
        cursorMs: result.segments[result.selectedIndex].startMs,
      });
      return true;
    },
    [applySegments, cursorSourceMs, nextSegId, segments, selectedIndex],
  );

  const deleteSelected = useCallback(() => {
    const result = deleteSegmentAt(segments, selectedIndex);
    if (!result) return false;
    applySegments(result.segments, result.selectedIndex, {
      pushUndo: true,
      cursorMs: result.segments[result.selectedIndex]?.startMs ?? 0,
    });
    return true;
  }, [applySegments, segments, selectedIndex]);

  const duplicateSelected = useCallback(() => {
    const result = duplicateSegmentAt(segments, selectedIndex, nextSegId());
    if (!result) {
      setError("이어 붙인 전체 길이는 최대 1분 이하여야 합니다.");
      return false;
    }
    applySegments(result.segments, result.selectedIndex, {
      pushUndo: true,
      cursorMs: result.segments[result.selectedIndex].startMs,
    });
    return true;
  }, [applySegments, nextSegId, segments, selectedIndex]);

  const reorderSelected = useCallback(
    (direction: -1 | 1) => {
      const result = moveSegmentOrder(segments, selectedIndex, direction);
      if (!result) return false;
      applySegments(result.segments, result.selectedIndex, {
        pushUndo: true,
        cursorMs: result.segments[result.selectedIndex].startMs,
      });
      return true;
    },
    [applySegments, segments, selectedIndex],
  );

  const undo = useCallback(() => {
    if (!undoStack.length) return false;
    stopPreview();
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setSegments(prev);
    const nextIdx = Math.max(0, Math.min(prev.length - 1, selectedIndex));
    setSelectedIndex(nextIdx);
    setCurrentMs(0);
    setCursorSourceMs(prev[nextIdx]?.startMs ?? 0);
    setError("");
    return true;
  }, [selectedIndex, stopPreview, undoStack]);

  const reset = useCallback(() => {
    if (durationMs === null) return;
    stopPreview();
    const initial = createInitialSegments(durationMs);
    if (segments.length) setUndoStack((stack) => [...stack.slice(-19), segments]);
    setSegments(initial);
    setSelectedIndex(0);
    setCurrentMs(0);
    setCursorSourceMs(0);
    setError("");
  }, [durationMs, segments, stopPreview]);

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

  return {
    durationMs,
    segments,
    selectedIndex,
    selection,
    totalMs,
    waveform,
    currentMs,
    setCurrentMs,
    cursorSourceMs,
    setCursorSourceMs,
    busy,
    error,
    setError,
    metadata,
    select,
    applySegments,
    selectSegment,
    splitAtCursor,
    deleteSelected,
    duplicateSelected,
    reorderSelected,
    undo,
    reset,
    canUndo: undoStack.length > 0,
    edited,
    save,
  };
}

export function AudioTrimPicker({
  url,
  onSave,
  onCancel,
  bpm = 120,
  signature = defaultSignature,
  enableSplice = true,
  hideActions = false,
  hidePreviewButton = false,
  onSelectionChange,
  onPreviewStateChange,
  previewControlRef,
  saveLabel,
}: {
  url: string;
  onSave: (selection: AudioSelection) => Promise<void>;
  onCancel?: () => void;
  bpm?: number;
  signature?: TimeSignature;
  enableSplice?: boolean;
  hideActions?: boolean;
  hidePreviewButton?: boolean;
  onSelectionChange?: (selection: AudioSelection | null) => void;
  onPreviewStateChange?: (playing: boolean) => void;
  previewControlRef?: MutableRefObject<{ toggle: () => void; stop: () => void } | null>;
  saveLabel: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveformPointerStartX = useRef<number | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    index: number;
    clientX: number;
    segments: SpliceSegment[];
    moved: boolean;
    undoPushed: boolean;
  } | null>(null);

  const webAudioRef = useRef<{
    ctx: AudioContext;
    sources: AudioBufferSourceNode[];
    rafId: number;
  } | null>(null);

  const [previewing, setPreviewing] = useState(false);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    const active = webAudioRef.current;
    if (active) {
      cancelAnimationFrame(active.rafId);
      active.sources.forEach((src) => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          /* ignore already stopped source */
        }
      });
      void active.ctx.close().catch(() => {});
      webAudioRef.current = null;
    }
    setPreviewing(false);
  }, []);

  const trim = useAudioTrim(url, onSave, stopPreview);
  const {
    durationMs,
    segments,
    selectedIndex,
    selection,
    totalMs,
    waveform,
    currentMs,
    setCurrentMs,
    cursorSourceMs,
    setCursorSourceMs,
    busy,
    error,
    setError,
    save,
  } = trim;

  const notifySelectionChange = useEffectEvent((sel: AudioSelection | null) => {
    onSelectionChange?.(sel);
  });
  const notifyPreviewStateChange = useEffectEvent((playing: boolean) => {
    onPreviewStateChange?.(playing);
  });

  useEffect(() => {
    notifySelectionChange(selection);
  }, [selection]);

  useEffect(() => {
    notifyPreviewStateChange(previewing);
  }, [previewing]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const beatTimeline = useMemo(
    () => (durationMs ? beatMarksForDuration(durationMs, bpm, signature) : null),
    [durationMs, bpm, signature],
  );
  const dimmedGaps = useMemo(
    () => (durationMs ? computeDimmedGaps(segments, durationMs) : []),
    [segments, durationMs],
  );

  function pointerRatio(clientX: number) {
    const rect = waveformRef.current ? logicalBounds(waveformRef.current) : null;
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function startDrag(event: ReactPointerEvent, mode: DragMode, index: number) {
    event.stopPropagation();
    trim.selectSegment(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      index,
      clientX: pointerAxes(event.currentTarget, event).x,
      segments,
      moved: false,
      undoPushed: false,
    };
  }

  function drag(event: ReactPointerEvent) {
    const state = dragRef.current;
    const rect = waveformRef.current ? logicalBounds(waveformRef.current) : null;
    if (!state || !durationMs || !rect) return;
    const dx = pointerAxes(event.currentTarget, event).x - state.clientX;
    if (!state.moved && Math.abs(dx) < 4) return;
    state.moved = true;
    const deltaMs = (dx / rect.width) * durationMs;
    const base = state.segments;
    const target = base[state.index];
    if (!target) return;
    const next =
      state.mode === "move"
        ? moveSegmentWindow(base, state.index, deltaMs, durationMs)
        : state.mode === "start"
          ? resizeSegmentStart(base, state.index, target.startMs + deltaMs, durationMs)
          : resizeSegmentEnd(base, state.index, target.endMs + deltaMs, durationMs);
    const shouldPushUndo = !state.undoPushed;
    if (shouldPushUndo) state.undoPushed = true;
    trim.applySegments(next, state.index, {
      pushUndo: shouldPushUndo,
      cursorMs:
        state.mode === "end" ? next[state.index]?.endMs : next[state.index]?.startMs,
    });
  }

  function finishDrag(event?: ReactPointerEvent) {
    const state = dragRef.current;
    dragRef.current = null;
    if (!state || state.mode !== "move" || state.moved || !event || !durationMs) return;
    const seg = segments[state.index];
    if (!seg) return;
    const tappedMs = Math.round((pointerRatio(pointerAxes(event.currentTarget, event).x) * durationMs) / 100) * 100;
    const clampedMs = Math.max(seg.startMs, Math.min(seg.endMs, tappedMs));
    stopPreview();
    setCursorSourceMs(clampedMs);
    let elapsedBefore = 0;
    for (let i = 0; i < state.index; i += 1) {
      elapsedBefore += segments[i].endMs - segments[i].startMs;
    }
    setCurrentMs(elapsedBefore + (clampedMs - seg.startMs));
  }

  function nudgeHandle(handle: "start" | "end", index: number, direction: number) {
    if (!durationMs) return;
    const seg = segments[index];
    if (!seg) return;
    const next =
      handle === "start"
        ? resizeSegmentStart(segments, index, seg.startMs + direction * 100, durationMs)
        : resizeSegmentEnd(segments, index, seg.endMs + direction * 100, durationMs);
    trim.applySegments(next, index, {
      pushUndo: true,
      cursorMs: handle === "start" ? next[index].startMs : next[index].endMs,
    });
  }

  const togglePreview = useCallback(async () => {
    if (!segments.length || totalMs <= 0) return;
    if (previewing) {
      stopPreview();
      return;
    }

    const startElapsed = currentMs >= totalMs - 100 ? 0 : currentMs;
    setCurrentMs(startElapsed);
    setError("");

    if (waveform?.buffer) {
      try {
        const AudioCtor = window.AudioContext;
        const ctx = new AudioCtor();
        if (ctx.state === "suspended") await ctx.resume();
        const { segmentIndex: startSegIndex, sourceMs } = splicedTimelinePosition(
          segments,
          startElapsed,
        );
        const epoch = ctx.currentTime + 0.02;
        let offsetSec = 0;
        const sources: AudioBufferSourceNode[] = [];
        for (let i = startSegIndex; i < segments.length; i += 1) {
          const seg = segments[i];
          const segStartMs = i === startSegIndex ? sourceMs : seg.startMs;
          const durSec = Math.max(0.01, (seg.endMs - segStartMs) / 1000);
          const src = ctx.createBufferSource();
          src.buffer = waveform.buffer;
          src.connect(ctx.destination);
          src.start(epoch + offsetSec, segStartMs / 1000, durSec);
          sources.push(src);
          offsetSec += durSec;
        }
        setPreviewing(true);
        const tick = () => {
          const active = webAudioRef.current;
          if (!active) return;
          const elapsed = Math.min(totalMs, startElapsed + Math.max(0, ctx.currentTime - epoch) * 1000);
          const pos = splicedTimelinePosition(segments, elapsed);
          setCurrentMs(elapsed);
          setCursorSourceMs(pos.sourceMs);
          if (elapsed >= totalMs - 8) {
            stopPreview();
            setCurrentMs(0);
            setCursorSourceMs(segments[0]?.startMs ?? 0);
            return;
          }
          active.rafId = requestAnimationFrame(tick);
        };
        const rafId = requestAnimationFrame(tick);
        webAudioRef.current = { ctx, sources, rafId };
        return;
      } catch {
        stopPreview();
        setError("선택 구간을 재생하지 못했습니다.");
        return;
      }
    }

    const audio = audioRef.current;
    const first = segments[0];
    if (!audio || !first) return;
    if (audio.currentTime * 1000 < first.startMs || audio.currentTime * 1000 >= first.endMs - 100) {
      audio.currentTime = first.startMs / 1000;
      setCurrentMs(0);
    }
    setPreviewing(true);
    try {
      await audio.play();
    } catch {
      setPreviewing(false);
      setError("선택 구간을 재생하지 못했습니다.");
    }
  }, [
    currentMs,
    previewing,
    segments,
    setCurrentMs,
    setCursorSourceMs,
    setError,
    stopPreview,
    totalMs,
    waveform,
  ]);

  useEffect(() => {
    if (!previewControlRef) return;
    previewControlRef.current = {
      toggle: () => {
        void togglePreview();
      },
      stop: stopPreview,
    };
    return () => {
      previewControlRef.current = null;
    };
  }, [previewControlRef, stopPreview, togglePreview]);

  const activeSegment = segments[selectedIndex] ?? segments[0];
  const canSplit = useMemo(() => {
    if (!segments.length) return false;
    return segments.some(
      (s) =>
        Math.round(cursorSourceMs / 100) * 100 >= s.startMs + minAudioClipMs &&
        Math.round(cursorSourceMs / 100) * 100 <= s.endMs - minAudioClipMs,
    );
  }, [cursorSourceMs, segments]);
  const canDuplicate = Boolean(
    activeSegment && totalMs + (activeSegment.endMs - activeSegment.startMs) <= maxAudioClipMs,
  );

  return (
    <div className={studioStyles.audioTrimPicker}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        {...trim.metadata}
        onTimeUpdate={(event) => {
          if (webAudioRef.current) return;
          const next = event.currentTarget.currentTime * 1000;
          if (!activeSegment) return;
          setCurrentMs(Math.max(0, next - activeSegment.startMs));
          setCursorSourceMs(next);
          if (previewing && next >= activeSegment.endMs) {
            event.currentTarget.pause();
            setCurrentMs(0);
            setCursorSourceMs(activeSegment.startMs);
            setPreviewing(false);
          }
        }}
        onEnded={() => setPreviewing(false)}
        onPause={() => {
          if (!webAudioRef.current) setPreviewing(false);
        }}
      />
      {durationMs != null && selection ? (
        <>
          <div className={studioStyles.audioTrimSummary}>
            <strong className="text-[20px] font-bold tracking-tight text-white">
              {formatTime(totalMs)}
            </strong>
            {segments.length > 1 && (
              <span className="text-caption tabular-nums text-app-muted">
                {segments.length}조각
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-[10px] bg-[#181820]">
            {beatTimeline && (
              <div
                className="relative h-6 border-b border-[#252532] bg-[#1a1a22] select-none"
                aria-label="박자표 눈금자"
              >
                {beatTimeline.marks.map((mark, index) => {
                  const leftPercent = (mark.ms / durationMs) * 100;
                  return (
                    <div
                      key={`${mark.bar}-${mark.beat}-${index}`}
                      className="pointer-events-none absolute top-0 bottom-0"
                      style={{ left: `${leftPercent}%` }}
                    >
                      <div
                        className={cn(
                          "w-px",
                          mark.isBar ? "h-full bg-[#525268]" : "mt-auto h-2 bg-[#2d2d3d]",
                        )}
                      />
                      {mark.label && leftPercent <= 94 && (
                        <span className="absolute top-0.5 left-1 text-[10px] font-semibold tabular-nums text-[#a1a1b5]">
                          {mark.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              ref={waveformRef}
              className={sharedStyles.audioWaveform}
              aria-label="오디오 구간 선택 파형"
              onPointerDown={(event) => {
                waveformPointerStartX.current = pointerAxes(event.currentTarget, event).x;
              }}
              onPointerUp={(event) => {
                const startX = waveformPointerStartX.current;
                waveformPointerStartX.current = null;
                const endX = pointerAxes(event.currentTarget, event).x;
                if (startX === null || Math.abs(endX - startX) > 6) return;
                const tappedMs = pointerRatio(endX) * durationMs;
                const currentSeg = segments[selectedIndex];
                if (currentSeg && tappedMs >= currentSeg.startMs && tappedMs <= currentSeg.endMs) {
                  stopPreview();
                  setCursorSourceMs(Math.round(tappedMs / 100) * 100);
                  return;
                }
                const hitIndex = segments.findIndex(
                  (seg) => tappedMs >= seg.startMs && tappedMs <= seg.endMs,
                );
                if (hitIndex >= 0) {
                  stopPreview();
                  trim.selectSegment(hitIndex);
                  setCursorSourceMs(Math.round(tappedMs / 100) * 100);
                  return;
                }
                if (segments.length === 1) {
                  const centered = centerAudioSelection(segments[0], tappedMs, durationMs);
                  trim.select(centered, { pushUndo: true });
                } else {
                  stopPreview();
                  setCursorSourceMs(Math.max(0, Math.min(durationMs, Math.round(tappedMs / 100) * 100)));
                }
              }}
            >
              {beatTimeline && (
                <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                  {beatTimeline.marks.map((mark, index) => (
                    <div
                      key={`grid-${index}`}
                      className={cn(
                        "absolute top-0 bottom-0 w-px",
                        mark.isBar ? "bg-white/[0.07]" : "bg-white/[0.025]",
                      )}
                      style={{ left: `${(mark.ms / durationMs) * 100}%` }}
                    />
                  ))}
                </div>
              )}

              {waveform?.peaks ? (
                <div className={sharedStyles.audioWaveformBars} aria-hidden="true">
                  {waveform.peaks.map((peak, index) => (
                    <i key={index} style={{ height: `${Math.round(peak * 82)}%` }} />
                  ))}
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 z-[3] grid place-items-center">
                  {waveform ? (
                    <p role="status" className="text-caption text-app-muted">
                      파형을 표시할 수 없습니다.
                    </p>
                  ) : (
                    <AudioTrimLoading label="파형을 계산하는 중입니다." />
                  )}
                </div>
              )}

              {dimmedGaps.map((gap, index) => (
                <div
                  key={`gap-${index}`}
                  className={sharedStyles.audioWaveformShade}
                  style={{
                    left: `${(gap.startMs / durationMs) * 100}%`,
                    width: `${((gap.endMs - gap.startMs) / durationMs) * 100}%`,
                  }}
                />
              ))}

              {segments.map((seg, index) => {
                const segLeft = (seg.startMs / durationMs) * 100;
                const segWidth = Math.max(0.5, ((seg.endMs - seg.startMs) / durationMs) * 100);
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={seg.id}
                    className={cn(
                      sharedStyles.audioWaveformSelection,
                      !isSelected &&
                        "z-[2] border-[#7c3aed]/70 bg-app-primary/10 opacity-85 hover:opacity-100",
                      isSelected && "z-[3] ring-1 ring-app-primary/40",
                    )}
                    style={{ left: `${segLeft}%`, width: `${segWidth}%` }}
                    onPointerDown={(event) => {
                      waveformPointerStartX.current = null;
                      startDrag(event, "move", index);
                    }}
                    onPointerMove={drag}
                    onPointerUp={(event) => finishDrag(event)}
                    onPointerCancel={() => finishDrag()}
                  >
                    {segments.length > 1 && (
                      <span
                        className={cn(
                          "pointer-events-none absolute top-1 left-2 rounded px-1 text-[10px] font-bold tabular-nums",
                          isSelected ? "bg-app-primary text-white" : "bg-[#23232a]/90 text-app-muted",
                        )}
                      >
                        #{index + 1}
                      </span>
                    )}
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          className={cn(studioStyles.audioTrimHandle, sharedStyles.start)}
                          aria-label="시작 위치 조절"
                          onPointerDown={(event) => {
                            waveformPointerStartX.current = null;
                            startDrag(event, "start", index);
                          }}
                          onPointerMove={drag}
                          onPointerUp={() => finishDrag()}
                          onPointerCancel={() => finishDrag()}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                              event.preventDefault();
                              nudgeHandle("start", index, event.key === "ArrowLeft" ? -1 : 1);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={cn(studioStyles.audioTrimHandle, sharedStyles.end)}
                          aria-label="종료 위치 조절"
                          onPointerDown={(event) => {
                            waveformPointerStartX.current = null;
                            startDrag(event, "end", index);
                          }}
                          onPointerMove={drag}
                          onPointerUp={() => finishDrag()}
                          onPointerCancel={() => finishDrag()}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                              event.preventDefault();
                              nudgeHandle("end", index, event.key === "ArrowLeft" ? -1 : 1);
                            }
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })}

              <div
                className="pointer-events-none absolute top-0 bottom-0 z-[5] w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.65)]"
                style={{ left: `${Math.max(0, Math.min(100, (cursorSourceMs / durationMs) * 100))}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className={sharedStyles.audioPreviewRow}>
            {!hidePreviewButton && (
              <button
                type="button"
                className={sharedStyles.audioPreviewToggle}
                onClick={() => {
                  void togglePreview();
                }}
                aria-label={previewing ? "미리 듣기 정지" : "선택 구간 미리 듣기"}
              >
                {previewing ? (
                  <Pause size={15} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play size={15} fill="currentColor" className="translate-x-[1px]" aria-hidden="true" />
                )}
              </button>
            )}
            <span>{formatTime(Math.min(currentMs, totalMs))}</span>
            <input
              type="range"
              min={0}
              max={Math.max(100, totalMs)}
              step={100}
              value={Math.min(currentMs, Math.max(100, totalMs))}
              aria-label="미리 듣기 위치"
              onChange={(event) => {
                const value = Number(event.target.value);
                stopPreview();
                setCurrentMs(value);
                const pos = splicedTimelinePosition(segments, value);
                setCursorSourceMs(pos.sourceMs);
                if (audioRef.current) audioRef.current.currentTime = pos.sourceMs / 1000;
              }}
            />
            <span className="!text-app-muted">{formatTime(totalMs)}</span>
          </div>

          {enableSplice && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-1.5" role="toolbar" aria-label="오디오 자르기 및 이어 붙이기 도구">
                <button
                  type="button"
                  disabled={busy || !canSplit}
                  onClick={() => trim.splitAtCursor(cursorSourceMs)}
                  className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-1 text-[11px] font-medium text-app-fg transition-colors hover:border-app-primary disabled:opacity-40"
                >
                  <Scissors size={12} aria-hidden="true" />
                  <span>자르기</span>
                </button>
                <button
                  type="button"
                  disabled={busy || segments.length <= 1}
                  onClick={() => trim.deleteSelected()}
                  className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-1 text-[11px] font-medium text-app-fg transition-colors hover:border-app-primary disabled:opacity-40"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  <span>삭제</span>
                </button>
                <button
                  type="button"
                  disabled={busy || !canDuplicate}
                  onClick={() => trim.duplicateSelected()}
                  className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-1 text-[11px] font-medium text-app-fg transition-colors hover:border-app-primary disabled:opacity-40"
                >
                  <CopyPlus size={12} aria-hidden="true" />
                  <span>붙이기</span>
                </button>
                <button
                  type="button"
                  disabled={busy || !trim.canUndo}
                  onClick={() => trim.undo()}
                  className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-1 text-[11px] font-medium text-app-fg transition-colors hover:border-app-primary disabled:opacity-40"
                >
                  <Undo2 size={12} aria-hidden="true" />
                  <span>되돌리기</span>
                </button>
                <button
                  type="button"
                  disabled={busy || !trim.edited}
                  onClick={() => trim.reset()}
                  className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-1 text-[11px] font-medium text-app-muted transition-colors hover:border-app-primary hover:text-app-fg disabled:opacity-40"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>초기화</span>
                </button>
              </div>

              {segments.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {segments.map((seg, index) => {
                    const active = index === selectedIndex;
                    return (
                      <div
                        key={seg.id}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] tabular-nums transition-colors",
                          active
                            ? "border-app-primary bg-app-primary/20 text-white"
                            : "border-[#32323d] bg-[#23232a] text-app-muted",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => trim.selectSegment(index)}
                          className="font-medium"
                        >
                          #{index + 1} {formatTime(seg.startMs)}–{formatTime(seg.endMs)}
                        </button>
                        {active && (
                          <span className="ml-0.5 flex items-center gap-0.5 border-l border-white/15 pl-1">
                            <button
                              type="button"
                              disabled={busy || index === 0}
                              aria-label="조각 앞으로 이동"
                              onClick={() => trim.reorderSelected(-1)}
                              className="rounded p-0.5 hover:bg-white/10 disabled:opacity-30"
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={busy || index === segments.length - 1}
                              aria-label="조각 뒤로 이동"
                              onClick={() => trim.reorderSelected(1)}
                              className="rounded p-0.5 hover:bg-white/10 disabled:opacity-30"
                            >
                              <ChevronRight size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : error ? null : (
        <AudioTrimLoading label="오디오 길이를 읽는 중입니다." />
      )}
      {error && (
        <p className={studioStyles.audioTrimError} role="alert">
          {error}
        </p>
      )}
      {!hideActions && (
        <div className={studioStyles.audioTrimActions}>
          {onCancel && (
            <button
              type="button"
              className={cn(buttonVariants({ tone: "secondary" }), "flex-1")}
              onClick={onCancel}
              disabled={busy}
            >
              취소
            </button>
          )}
          <button
            type="button"
            className={cn(buttonVariants({ tone: "primary" }), "flex-1")}
            onClick={() => {
              void save();
            }}
            disabled={!selection || busy}
          >
            {busy ? "올리는 중..." : saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { NativeAudioTrim, NativeAudioTrimAction } from "@/lib/native-screens";
import { splicedTimelinePosition } from "./audio-splice";
import { useAudioTrim } from "./audio-trim-picker";
import { maxAudioClipMs, minAudioClipMs } from "./audio-trim-selection";
import type { SelectedAudio } from "./creation-screens";
import type { AudioSelection } from "./prepare-audio-file";
import { defaultSignature, type TimeSignature } from "./time-signature";
import { useCompositionPlayback } from "./use-composition-playback";

/** The selection follows the web's trim rules: inside the file, 0.1 s to 1 min, 100 ms steps. */
function validSelection(selection: AudioSelection, durationMs: number) {
  const { startMs, endMs } = selection;
  const length = endMs - startMs;
  return (
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    startMs >= 0 &&
    endMs <= durationMs &&
    length >= Math.min(minAudioClipMs, durationMs) &&
    length <= maxAudioClipMs
  );
}

/**
 * The app's audio trim for a chosen file (the web's AudioTrimPicker; `useSelectedAudio` keeps the
 * file and its URL): length, waveform, splice segments, selection and saving come from `useAudioTrim`;
 * the preview plays through the playback hook's `previewAudio` (the app's audio engine).
 */
export function useNativeAudioTrim(
  audio: SelectedAudio | null,
  {
    saveLabel,
    onSave,
    bpm = 120,
    signature = defaultSignature,
    enableSplice = true,
    hideActions = false,
    hidePreviewButton = false,
  }: {
    saveLabel: string;
    onSave: (selection: AudioSelection) => Promise<void>;
    bpm?: number;
    signature?: TimeSignature;
    enableSplice?: boolean;
    hideActions?: boolean;
    hidePreviewButton?: boolean;
  },
): {
  model: NativeAudioTrim | null;
  act: (action: NativeAudioTrimAction) => void;
  node: ReactNode;
  selection: AudioSelection | null;
  previewing: boolean;
  stopPreview: () => void;
} {
  const file = audio?.file ?? null;
  const url = audio?.url ?? null;
  const scope = useId();
  const { previewAudio, stopPreview: stopPlayerPreview } = useCompositionPlayback(null, {
    scopeKey: JSON.stringify(["trim", scope]),
  });
  // previewAudio resolves once the sound started; the position is timed from there.
  const [preview, setPreview] = useState<{ startedAt: number; fromMs: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewRequest = useRef(0);
  const trim = useAudioTrim(url, onSave, stopPreview);
  const {
    durationMs,
    segments,
    selectedIndex,
    selection,
    totalMs,
    currentMs,
    setCurrentMs,
    cursorSourceMs,
    setCursorSourceMs,
  } = trim;

  function stopPreview() {
    previewRequest.current++;
    stopPlayerPreview();
    setPreview(null);
    setPreviewing(false);
  }

  useEffect(() => {
    if (!preview || !segments.length) return;
    const timer = window.setInterval(() => {
      const next = preview.fromMs + (Date.now() - preview.startedAt);
      if (next < totalMs) {
        setCurrentMs(next);
        setCursorSourceMs(splicedTimelinePosition(segments, next).sourceMs);
        return;
      }
      previewRequest.current++;
      stopPlayerPreview();
      setPreview(null);
      setPreviewing(false);
      setCurrentMs(0);
      setCursorSourceMs(segments[0]?.startMs ?? 0);
    }, 100);
    return () => window.clearInterval(timer);
  }, [preview, segments, totalMs, stopPlayerPreview, setCurrentMs, setCursorSourceMs]);

  async function togglePreview() {
    if (!file || !selection || !segments.length || totalMs <= 0) return;
    if (previewing) {
      stopPreview();
      return;
    }
    const fromMs = currentMs < 0 || currentMs >= totalMs - 100 ? 0 : currentMs;
    setCurrentMs(fromMs);
    const request = ++previewRequest.current;
    setPreviewing(true);
    trim.setError("");
    try {
      const activeSelection: AudioSelection =
        segments.length > 1
          ? (() => {
              const { segmentIndex, sourceMs } = splicedTimelinePosition(segments, fromMs);
              const sliced = [
                { startMs: sourceMs, endMs: segments[segmentIndex].endMs },
                ...segments.slice(segmentIndex + 1).map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
              ];
              return {
                startMs: sliced[0].startMs,
                endMs: sliced[sliced.length - 1].endMs,
                segments: sliced,
              };
            })()
          : {
              startMs: segments[0].startMs + fromMs,
              endMs: segments[0].endMs,
            };
      await previewAudio({ file, selection: activeSelection });
      if (request === previewRequest.current) setPreview({ startedAt: Date.now(), fromMs });
    } catch {
      if (request !== previewRequest.current) return;
      setPreviewing(false);
      trim.setError("선택 구간을 재생하지 못했습니다.");
    }
  }

  function act(action: NativeAudioTrimAction) {
    switch (action.type) {
      case "trim-select": {
        const next = { startMs: action.startMs, endMs: action.endMs };
        if (durationMs !== null && validSelection(next, durationMs)) trim.select(next, { pushUndo: true });
        return;
      }
      case "trim-preview":
        return void togglePreview();
      case "trim-position": {
        if (!segments.length) return;
        stopPreview();
        const clamped = Math.max(0, Math.min(action.positionMs, totalMs));
        setCurrentMs(clamped);
        setCursorSourceMs(splicedTimelinePosition(segments, clamped).sourceMs);
        return;
      }
      case "trim-cursor":
        stopPreview();
        setCursorSourceMs(Math.max(0, Math.min(durationMs ?? 0, action.sourceMs)));
        return;
      case "trim-split":
        trim.splitAtCursor(cursorSourceMs);
        return;
      case "trim-delete-segment":
        trim.deleteSelected();
        return;
      case "trim-duplicate-segment":
        trim.duplicateSelected();
        return;
      case "trim-select-segment":
        trim.selectSegment(action.index);
        return;
      case "trim-reorder-segment":
        trim.reorderSelected(action.direction);
        return;
      case "trim-undo":
        trim.undo();
        return;
      case "trim-reset":
        trim.reset();
        return;
      case "trim-save":
        return void trim.save();
    }
  }

  const timeSignature = `${signature.numerator}/${signature.denominator}`;
  const model: NativeAudioTrim | null = file
    ? {
        durationMs: selection ? durationMs : null,
        selection: selection ? { startMs: selection.startMs, endMs: selection.endMs } : null,
        segments: segments.map(({ startMs, endMs }) => ({ startMs, endMs })),
        selectedSegmentIndex: selectedIndex,
        canUndo: trim.canUndo,
        edited: trim.edited,
        enableSplice,
        hideActions,
        hidePreviewButton,
        bpm,
        timeSignature,
        peaks: trim.waveform?.peaks?.map((peak) => Math.round(peak * 100) / 100) ?? null,
        waveformFailed: trim.waveform !== null && trim.waveform.peaks === null,
        previewing,
        positionMs: Math.round(Math.max(0, Math.min(currentMs, totalMs))),
        cursorSourceMs: Math.round(cursorSourceMs),
        busy: trim.busy,
        error: trim.error || null,
        saveLabel,
      }
    : null;
  const node = url ? (
    <audio key={url} src={url} preload="metadata" hidden {...trim.metadata} />
  ) : null;
  return { model, act, node, selection, previewing, stopPreview };
}

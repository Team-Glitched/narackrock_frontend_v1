import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { NativeAudioTrim, NativeAudioTrimAction } from "@/lib/native-screens";
import { useAudioTrim } from "./audio-trim-picker";
import { maxAudioClipMs, minAudioClipMs } from "./audio-trim-selection";
import type { SelectedAudio } from "./creation-screens";
import type { AudioSelection } from "./prepare-audio-file";
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
 * file and its URL): length, waveform, selection and saving come from `useAudioTrim`; the preview
 * plays through the playback hook's `previewAudio` (the app's audio engine). Put `model` in the
 * screen model, forward `isNativeAudioTrimAction` actions to `act` and render `node` (a hidden
 * `<audio>` that reads the length). `model` is null without a file.
 */
export function useNativeAudioTrim(
  audio: SelectedAudio | null,
  {
    saveLabel,
    onSave,
    onCancel,
  }: {
    saveLabel: string;
    onSave: (selection: AudioSelection) => Promise<void>;
    onCancel?: () => void;
  },
): {
  model: NativeAudioTrim | null;
  act: (action: NativeAudioTrimAction) => void;
  node: ReactNode;
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
  const { durationMs, selection, currentMs, setCurrentMs } = trim;

  function stopPreview() {
    previewRequest.current++;
    stopPlayerPreview();
    setPreview(null);
    setPreviewing(false);
  }

  useEffect(() => {
    if (!preview || !selection) return;
    const timer = window.setInterval(() => {
      const next = preview.fromMs + (Date.now() - preview.startedAt);
      if (next < selection.endMs) {
        setCurrentMs(next);
        return;
      }
      previewRequest.current++;
      stopPlayerPreview();
      setPreview(null);
      setPreviewing(false);
      setCurrentMs(selection.endMs);
    }, 100);
    return () => window.clearInterval(timer);
  }, [preview, selection, stopPlayerPreview, setCurrentMs]);

  async function togglePreview() {
    if (!file || !selection) return;
    if (previewing) {
      stopPreview();
      return;
    }
    const fromMs =
      currentMs < selection.startMs || currentMs >= selection.endMs - 100
        ? selection.startMs
        : currentMs;
    setCurrentMs(fromMs);
    const request = ++previewRequest.current;
    setPreviewing(true);
    trim.setError("");
    try {
      await previewAudio({ file, selection: { startMs: fromMs, endMs: selection.endMs } });
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
        if (durationMs !== null && validSelection(next, durationMs)) trim.select(next);
        return;
      }
      case "trim-preview":
        return void togglePreview();
      case "trim-position":
        if (!selection) return;
        stopPreview();
        setCurrentMs(Math.max(selection.startMs, Math.min(action.positionMs, selection.endMs)));
        return;
      case "trim-save":
        return void trim.save();
      case "trim-cancel":
        if (!trim.busy) onCancel?.();
        return;
    }
  }

  const model: NativeAudioTrim | null = file
    ? {
        durationMs: selection ? durationMs : null,
        selection,
        peaks: trim.waveform?.peaks?.map((peak) => Math.round(peak * 100) / 100) ?? null,
        waveformFailed: trim.waveform !== null && trim.waveform.peaks === null,
        previewing,
        positionMs: selection
          ? Math.round(Math.max(selection.startMs, Math.min(currentMs, selection.endMs)))
          : 0,
        busy: trim.busy,
        error: trim.error || null,
        saveLabel,
        cancel: onCancel !== undefined,
      }
    : null;
  const node = url ? (
    <audio key={url} src={url} preload="metadata" hidden {...trim.metadata} />
  ) : null;
  return { model, act, node };
}

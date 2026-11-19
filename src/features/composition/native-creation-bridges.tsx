import type { AudioTranscriptionMode } from "@/lib/api/composition";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeAudio } from "@/lib/native-app";
import type {
  NativeCreationRecord,
  NativeCreationRecordAction,
  NativeCreationUpload,
  NativeCreationUploadAction,
  NativeHeader,
  NativeInstrumentAction,
  NativeInstrumentPicker,
} from "@/lib/native-screens";
import { isNativeAudioTrimAction } from "@/lib/native-screens/creation";
import { isNativeInstrumentAction } from "@/lib/native-screens/studio";
import { useCompositionRecorder, useSelectedAudio } from "./creation-screens";
import { useNativeAudioTrim } from "./native-audio-trim";
import type { AudioSelection } from "./prepare-audio-file";
import { useCompositionPlayback } from "./use-composition-playback";

/** The instrument prompt's app part (`useInstrumentPrompt(projectId).native`). */
export type NativeInstrumentPrompt = {
  model: NativeInstrumentPicker | null;
  act: (action: NativeInstrumentAction) => void;
};

/** Header of the creation pages and the sample registration audio steps (the web `Header` with back). */
export const creationHeader: NativeHeader = {
  left: "back",
  actions: ["notifications", "search", "account"],
};

type Navigation = { onBack: () => void; onSearch: () => void };

/**
 * The app's upload screen (the web's CompositionUploadScreen): the file comes from the platform file
 * picker, the trim is `useNativeAudioTrim`. `onSave` is the page's own save.
 */
export function useNativeUpload({
  saveLabel,
  onSave,
  instrument,
  notice = null,
}: {
  saveLabel: string;
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  instrument?: NativeInstrumentPrompt;
  /** A page error shown above the screen (the studio pages' failed "신규 트랙" cancel). */
  notice?: string | null;
}) {
  const [audio, selectAudio] = useSelectedAudio();
  const [pickError, setPickError] = useState<string | null>(null);
  const trim = useNativeAudioTrim(audio, {
    saveLabel,
    onSave: (selection) => (audio ? onSave(audio.file, selection) : Promise.resolve()),
  });
  const model: NativeCreationUpload = {
    fileName: audio?.file.name ?? null,
    error: pickError ?? notice,
    trim: trim.model,
    instrument: instrument?.model ?? null,
  };
  function act(action: NativeCreationUploadAction) {
    if (isNativeInstrumentAction(action)) return instrument?.act(action);
    if (isNativeAudioTrimAction(action)) return trim.act(action);
    if (action.type === "creation-upload-pick") {
      setPickError(null);
      void pickNativeAudio().then(
        (file) => {
          if (file) selectAudio(file);
        },
        (cause: unknown) =>
          setPickError(
            cause instanceof Error ? cause.message : "오디오 파일을 불러오지 못했습니다.",
          ),
      );
    }
  }
  return { model, act, node: trim.node };
}

/**
 * The app's record screen (the web's CompositionRecordScreen): the app records
 * (`useCompositionRecorder` native mode) and draws the live meter and elapsed time; the finished
 * recording plays through the playback hook's `previewAudio`.
 */
export function useNativeRecord({
  saveLabel,
  onSave,
  onTransform,
  instrument,
  notice = null,
}: {
  saveLabel: string;
  onSave: (file: File) => Promise<void>;
  onTransform?: (file: File, soundKind?: AudioTranscriptionMode) => Promise<void>;
  instrument?: NativeInstrumentPrompt;
  notice?: string | null;
}) {
  const scope = useId();
  const { previewAudio, stopPreview } = useCompositionPlayback(null, {
    scopeKey: JSON.stringify(["recording", scope]),
  });
  // previewAudio resolves once the sound started; it ends after the recording's length.
  const [preview, setPreview] = useState<{ request: number; started: boolean } | null>(null);
  const recorder = useCompositionRecorder({
    onSave,
    onTransform,
    native: true,
    beforeSubmit: () => {
      stopPreview();
      setPreview(null);
    },
  });
  const { durationMs } = recorder;
  useEffect(() => {
    if (!preview?.started) return;
    const timer = window.setTimeout(() => setPreview(null), durationMs ?? 0);
    return () => window.clearTimeout(timer);
  }, [preview, durationMs]);

  function togglePreview() {
    const file = recorder.file;
    if (preview) {
      stopPreview();
      setPreview(null);
      return;
    }
    if (!file || recorder.pending) return;
    const request = Date.now();
    setPreview({ request, started: false });
    void previewAudio({ file }).then(
      () =>
        setPreview((current) =>
          current?.request === request ? { request, started: true } : current,
        ),
      () => setPreview((current) => (current?.request === request ? null : current)),
    );
  }
  const model: NativeCreationRecord = {
    recording: recorder.recording,
    pending: recorder.pending,
    status: recorder.status,
    error: recorder.error || null,
    recorded: recorder.file !== null,
    previewing: preview !== null,
    saveLabel,
    transform: onTransform !== undefined,
    soundKind: recorder.soundKind,
    notice,
    instrument: instrument?.model ?? null,
  };
  function act(action: NativeCreationRecordAction) {
    if (isNativeInstrumentAction(action)) return instrument?.act(action);
    switch (action.type) {
      case "creation-record-toggle":
        if (recorder.pending) return;
        stopPreview();
        setPreview(null);
        return void recorder.toggle();
      case "creation-record-save":
        return void recorder.save();
      case "creation-record-sound-kind":
        if (!recorder.pending && ["AUTO", "HUMMING", "INSTRUMENT"].includes(action.kind))
          recorder.setSoundKind(action.kind);
        return;
      case "creation-record-transform":
        return void recorder.transform();
      case "creation-record-preview":
        return togglePreview();
    }
  }
  return { model, act };
}

/** /studio/:projectId/upload in the app. */
export function NativeUploadBridge({
  onSave,
  instrument,
  notice,
  onBack,
  onSearch,
}: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  instrument: NativeInstrumentPrompt;
  notice: string | null;
} & Navigation): ReactNode {
  const upload = useNativeUpload({
    saveLabel: "선택 구간을 레이어에 저장",
    onSave,
    instrument,
    notice,
  });
  const node = useNativeScreen("creation-upload", upload.model, {
    header: creationHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") upload.act(action);
    },
  });
  return (
    <>
      {node}
      {upload.node}
    </>
  );
}

/** /studio/:projectId/record in the app. */
export function NativeRecordBridge({
  onSave,
  onTransform,
  instrument,
  notice,
  onBack,
  onSearch,
}: {
  onSave: (file: File) => Promise<void>;
  onTransform: (file: File, soundKind?: AudioTranscriptionMode) => Promise<void>;
  instrument: NativeInstrumentPrompt;
  notice: string | null;
} & Navigation): ReactNode {
  const record = useNativeRecord({
    saveLabel: "레이어에 녹음 저장",
    onSave,
    onTransform,
    instrument,
    notice,
  });
  return useNativeScreen("creation-record", record.model, {
    header: creationHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") record.act(action);
    },
  });
}

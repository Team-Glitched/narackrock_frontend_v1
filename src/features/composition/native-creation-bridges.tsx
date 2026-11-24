import type { AudioTranscriptionMode } from "@/lib/api/composition";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { isNativeInstrumentAction, isNativeTimingAction } from "@/lib/native-screens/studio";
import type { CreationTimingMode } from "./creation-timing-bar";
import { useCompositionRecorder, useSelectedAudio, type SelectedAudio } from "./creation-screens";
import { useNativeAudioTrim } from "./native-audio-trim";
import type { AudioSelection } from "./prepare-audio-file";
import type { ProjectTiming } from "./project-timing";
import { defaultSignature, parseSignature, type TimeSignature } from "./time-signature";
import { useNativeTiming } from "./timing-dialog";

/** The instrument prompt's app part (`useInstrumentPrompt(projectId).native`). */
export type NativeInstrumentPrompt = {
  model: NativeInstrumentPicker | null;
  act: (action: NativeInstrumentAction) => void;
};

/** Header of the creation pages and the sample registration audio steps (the web `Header` with back). */
export const creationHeader: NativeHeader = {
  left: "back",
  actions: [],
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
  bpm = 120,
  signature = defaultSignature,
  onTiming,
  timingMode = onTiming ? "editable" : "locked",
}: {
  saveLabel: string;
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  instrument?: NativeInstrumentPrompt;
  /** A page error shown above the screen (the studio pages' failed "신규 트랙" cancel). */
  notice?: string | null;
  bpm?: number;
  signature?: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
}) {
  const [audio, selectAudio] = useSelectedAudio();
  const [pickError, setPickError] = useState<string | null>(null);
  const trim = useNativeAudioTrim(audio, {
    saveLabel,
    bpm,
    signature,
    enableSplice: true,
    onSave: (selection) => (audio ? onSave(audio.file, selection) : Promise.resolve()),
  });
  const timing = useNativeTiming({ bpm, signature }, onTiming);
  const timeSignature = `${signature.numerator}/${signature.denominator}`;
  const model: NativeCreationUpload = {
    fileName: audio?.file.name ?? null,
    error: pickError ?? notice,
    trim: trim.model,
    instrument: instrument?.model ?? null,
    bpm,
    timeSignature,
    timingMode,
    timing: timing.model,
  };
  function act(action: NativeCreationUploadAction) {
    if (isNativeInstrumentAction(action)) return instrument?.act(action);
    if (isNativeTimingAction(action)) return timing.act(action);
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
 * (`useCompositionRecorder` native mode) and draws the live meter and elapsed time;
 * once finished, `useNativeAudioTrim` powers the beat ruler and cut/splice tools.
 */
export function useNativeRecord({
  saveLabel,
  onSave,
  onTransform,
  instrument,
  notice = null,
  bpm = 120,
  timeSignature = "4/4",
  signature,
  onTiming,
  timingMode = onTiming ? "editable" : "locked",
}: {
  saveLabel: string;
  onSave: (file: File, selection?: AudioSelection) => Promise<void>;
  onTransform?: (
    file: File,
    soundKind?: AudioTranscriptionMode,
    selection?: AudioSelection,
  ) => Promise<void>;
  instrument?: NativeInstrumentPrompt;
  notice?: string | null;
  bpm?: number;
  timeSignature?: string;
  signature?: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
}) {
  const resolvedSignature = useMemo(
    () => signature ?? parseSignature(timeSignature),
    [signature, timeSignature],
  );
  const formattedSignature = `${resolvedSignature.numerator}/${resolvedSignature.denominator}`;
  const selectionRef = useRef<AudioSelection | undefined>(undefined);
  const stopTrimPreviewRef = useRef<() => void>(() => {});

  const recorder = useCompositionRecorder({
    onSave: (file) => onSave(file, selectionRef.current),
    onTransform: onTransform
      ? (file, kind) => onTransform(file, kind, selectionRef.current)
      : undefined,
    native: true,
    beforeSubmit: () => stopTrimPreviewRef.current(),
  });

  const recordedAudio: SelectedAudio | null =
    recorder.file && recorder.url ? { file: recorder.file, url: recorder.url } : null;

  const trim = useNativeAudioTrim(recordedAudio, {
    saveLabel,
    bpm,
    signature: resolvedSignature,
    enableSplice: true,
    hideActions: true,
    hidePreviewButton: true,
    onSave: async () => {},
  });
  useEffect(() => {
    selectionRef.current = trim.selection ?? undefined;
  }, [trim.selection]);
  useEffect(() => {
    stopTrimPreviewRef.current = trim.stopPreview;
  }, [trim.stopPreview]);

  const timing = useNativeTiming({ bpm, signature: resolvedSignature }, onTiming);

  const model: NativeCreationRecord = {
    recording: recorder.recording,
    pending: recorder.pending,
    status: recorder.status,
    error: recorder.error || null,
    recorded: recorder.file !== null,
    previewing: trim.previewing,
    saveLabel,
    transform: onTransform !== undefined,
    soundKind: recorder.soundKind,
    notice,
    instrument: instrument?.model ?? null,
    bpm,
    timeSignature: formattedSignature,
    timingMode,
    timing: timing.model,
    trim: trim.model,
  };
  function act(action: NativeCreationRecordAction) {
    if (isNativeInstrumentAction(action)) return instrument?.act(action);
    if (isNativeTimingAction(action)) return timing.act(action);
    if (isNativeAudioTrimAction(action)) return trim.act(action);
    switch (action.type) {
      case "creation-record-toggle":
        if (recorder.pending) return;
        trim.stopPreview();
        return void recorder.toggle();
      case "creation-record-retry":
        if (recorder.pending) return;
        trim.stopPreview();
        selectionRef.current = undefined;
        recorder.reset();
        return;
      case "creation-record-save":
        return void recorder.save();
      case "creation-record-sound-kind":
        if (!recorder.pending && ["AUTO", "HUMMING", "INSTRUMENT"].includes(action.kind))
          recorder.setSoundKind(action.kind);
        return;
      case "creation-record-transform":
        return void recorder.transform();
      case "creation-record-preview":
        return trim.act({ type: "trim-preview" });
    }
  }
  return { model, act, node: trim.node };
}

/** /studio/:projectId/upload in the app. */
export function NativeUploadBridge({
  onSave,
  instrument,
  notice,
  bpm,
  signature,
  onTiming,
  timingMode,
  onBack,
  onSearch,
}: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  instrument: NativeInstrumentPrompt;
  notice: string | null;
  bpm?: number;
  signature?: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
} & Navigation): ReactNode {
  const upload = useNativeUpload({
    saveLabel: "선택 구간을 레이어에 저장",
    onSave,
    instrument,
    notice,
    bpm,
    signature,
    onTiming,
    timingMode,
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
  bpm,
  signature,
  timeSignature,
  onTiming,
  timingMode,
  onBack,
  onSearch,
}: {
  onSave: (file: File, selection?: AudioSelection) => Promise<void>;
  onTransform: (
    file: File,
    soundKind?: AudioTranscriptionMode,
    selection?: AudioSelection,
  ) => Promise<void>;
  instrument: NativeInstrumentPrompt;
  notice: string | null;
  bpm?: number;
  signature?: TimeSignature;
  timeSignature?: string;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
} & Navigation): ReactNode {
  const record = useNativeRecord({
    saveLabel: "레이어에 녹음 저장",
    onSave,
    onTransform,
    instrument,
    notice,
    bpm,
    signature,
    timeSignature,
    onTiming,
    timingMode,
  });
  const node = useNativeScreen("creation-record", record.model, {
    header: creationHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") record.act(action);
    },
  });
  return (
    <>
      {node}
      {record.node}
    </>
  );
}

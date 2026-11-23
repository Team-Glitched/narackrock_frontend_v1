import type { AudioTranscriptionMode } from "@/lib/api/composition";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { FileAudio, Mic, RotateCcw, Square, Upload } from "lucide-react";
import { Asset } from "@/components/asset";
import { Dropdown } from "@/components/dropdown";
import { AudioTrimPicker, formatTrimTime } from "@/features/composition/audio-trim-picker";
import {
  CreationTimingBar,
  type CreationTimingMode,
} from "@/features/composition/creation-timing-bar";
import { MetronomeIcon } from "@/features/composition/metronome-icon";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import type { ProjectTiming } from "@/features/composition/project-timing";
import {
  defaultSignature,
  parseSignature,
  type TimeSignature,
} from "@/features/composition/time-signature";
import { beatsPerBarFromSignature, useMetronome } from "@/features/composition/use-metronome";
import { recordNativeAudio } from "@/lib/native-app";

export type CreationMethod = "upload" | "record" | "note";

// The three-card selection layout comes from the team's origin/fix/overall ChooseScreen.
export function CompositionChoiceScreen({
  onChoose,
  busy,
  error,
}: {
  onChoose: (method: CreationMethod) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className={cn(sharedStyles.chooseView, sharedStyles.scrollContent)}>
      {error && <p role="alert">{error}</p>}
      {(
        [
          {
            method: "upload",
            label: "업로드",
            description: "오디오 파일을 불러와 레이어로 추가합니다.",
            image: "choose-upload.png",
          },
          {
            method: "record",
            label: "녹음",
            description: "연주나 목소리를 직접 녹음합니다.",
            image: "choose-record.png",
          },
          {
            method: "note",
            label: "피아노롤",
            description: "노트를 배치해 멜로디를 만듭니다.",
            image: "choose-piano.png",
          },
        ] as const
      ).map((item) => (
        <button
          className={sharedStyles.creationChoice}
          key={item.method}
          disabled={busy}
          onClick={() => onChoose(item.method)}
        >
          <span className={sharedStyles.creationChoiceCopy}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </span>
          {item.method === "note" ? (
            <div className={sharedStyles.creationPianoPreview} aria-hidden="true">
              <span className={sharedStyles.creationPianoKeys} />
              {Array.from({ length: 6 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
          ) : (
            <Asset name={item.image} />
          )}
        </button>
      ))}
    </div>
  );
}

/** A chosen audio file and its object URL (revoked when replaced or on unmount). */
export type SelectedAudio = { file: File; url: string };

/** The upload screens' chosen file, shared by the web screen and the app's native upload. */
export function useSelectedAudio() {
  const [selected, setSelected] = useState<SelectedAudio | null>(null);
  useEffect(
    () => () => {
      if (selected) URL.revokeObjectURL(selected.url);
    },
    [selected],
  );
  const select = (file: File) => setSelected({ file, url: URL.createObjectURL(file) });
  return [selected, select] as const;
}

// The file selection and preview follow the team's UploadScreen; saving is wired to the project API.
export function CompositionUploadScreen({
  onSave,
  bpm = 120,
  signature = defaultSignature,
  onTiming,
  timingMode = onTiming ? "editable" : "locked",
  saveLabel = "선택 구간을 레이어에 저장",
}: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  bpm?: number;
  signature?: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
  saveLabel?: string;
  onBack: () => void;
}) {
  const [selected, select] = useSelectedAudio();
  return (
    <div className={cn(sharedStyles.uploadView, sharedStyles.scrollContent)}>
      <CreationTimingBar
        bpm={bpm}
        signature={signature}
        onTiming={onTiming}
        timingMode={timingMode}
      />
      {!selected ? (
        <label className={sharedStyles.uploadArea}>
          <span className="grid size-14 place-items-center rounded-full bg-app-primary/15 text-[#c4b5fd]">
            <Upload size={26} aria-hidden="true" />
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <strong className="text-title font-bold text-white">오디오 파일 업로드</strong>
            <span className="text-caption leading-relaxed text-app-muted">
              WAV, MP3, M4A, FLAC · 박자에 맞춰 자르고 이어 붙이기
            </span>
          </div>
          <span className="mt-1 rounded-full bg-app-primary px-5 py-2.5 text-body font-semibold text-white">
            업로드 파일 선택
          </span>
          <input
            type="file"
            accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) select(file);
              event.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#32323d] bg-[#1e1e26] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileAudio size={18} className="shrink-0 text-[#c4b5fd]" aria-hidden="true" />
              <span className="truncate text-body font-medium text-white">
                {selected.file.name}
              </span>
            </div>
            <label className="relative shrink-0 cursor-pointer rounded-[8px] border border-[#32323d] bg-[#23232a] px-2.5 py-1.5 text-caption font-medium text-app-fg transition-colors hover:border-app-primary">
              <span>파일 변경</span>
              <input
                type="file"
                className="sr-only"
                accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) select(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="rounded-[18px] border border-[#32323d] bg-[#1e1e26] p-4">
            <AudioTrimPicker
              key={selected.url}
              url={selected.url}
              bpm={bpm}
              signature={signature}
              enableSplice
              onSave={(selection) => onSave(selected.file, selection)}
              saveLabel={saveLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Horizontal pixels per animation frame; the waveform scrolls at about 120px per second. */
const WAVE_COLUMN_WIDTH = 2;

/** Live microphone waveform scrolling from right to left while reporting elapsed ms. */
function RecordingMeter({
  stream,
  onElapsedMs,
}: {
  stream: MediaStream;
  onElapsedMs: (ms: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reportElapsed = useEffectEvent((ms: number) => onElapsedMs(ms));

  useEffect(() => {
    const element = canvas.current;
    const context2d = element?.getContext("2d");
    if (!element || !context2d) return;
    const audio = new AudioContext();
    void audio.resume();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    const source = audio.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    // Signed minimum and maximum sample of each frame: the real waveform envelope, not a level meter.
    const lows: number[] = [];
    const highs: number[] = [];
    const color = getComputedStyle(element).color || "#7c3aed";
    const startedAt = performance.now();
    let previous = startedAt;
    let lastReportedDeci = -1;
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const elapsedMs = Math.max(0, now - startedAt);
      const deci = Math.floor(elapsedMs / 100);
      if (deci !== lastReportedDeci) {
        lastReportedDeci = deci;
        reportElapsed(deci * 100);
      }
      analyser.getFloatTimeDomainData(samples);
      // Only the samples that arrived since the previous frame belong to this column.
      const fresh = Math.min(
        samples.length,
        Math.max(1, Math.round(((now - previous) / 1000) * audio.sampleRate)),
      );
      previous = now;
      let low = 0;
      let high = 0;
      for (let index = samples.length - fresh; index < samples.length; index += 1) {
        low = Math.min(low, samples[index]);
        high = Math.max(high, samples[index]);
      }
      lows.push(low);
      highs.push(high);
      const ratio = window.devicePixelRatio || 1;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
      if (element.height !== Math.round(height * ratio))
        element.height = Math.round(height * ratio);
      const capacity = Math.ceil(width / WAVE_COLUMN_WIDTH) + 1;
      if (lows.length > capacity) {
        lows.splice(0, lows.length - capacity);
        highs.splice(0, highs.length - capacity);
      }
      const middle = height / 2;
      const x = (index: number) => width - (lows.length - 1 - index) * WAVE_COLUMN_WIDTH;
      const y = (sample: number) => middle - Math.max(-1, Math.min(1, sample)) * (middle - 2);
      context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
      context2d.clearRect(0, 0, width, height);
      context2d.globalAlpha = 0.25;
      context2d.fillStyle = color;
      context2d.fillRect(0, middle - 0.5, width, 1);
      context2d.globalAlpha = 1;
      context2d.beginPath();
      highs.forEach((sample, index) =>
        context2d.lineTo(x(index), Math.min(middle - 0.75, y(sample))),
      );
      for (let index = lows.length - 1; index >= 0; index -= 1)
        context2d.lineTo(x(index), Math.max(middle + 0.75, y(lows[index])));
      context2d.closePath();
      const fill = context2d.createLinearGradient(0, 0, width, 0);
      fill.addColorStop(0, "transparent");
      fill.addColorStop(0.25, color);
      fill.addColorStop(1, "#a78bfa");
      context2d.fillStyle = fill;
      context2d.fill();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void audio.close();
    };
  }, [stream]);

  return <canvas ref={canvas} className="h-full w-full text-app-primary" aria-hidden="true" />;
}

/**
 * Recording, saving and HTI conversion of the record screens, shared by the web screen
 * (MediaRecorder) and the app's native record screen (`native`: the app records through
 * `recordNativeAudio`; `durationMs` is the recording's length for timing its preview).
 * `beforeSubmit` stops the caller's player before saving or converting.
 */
export function useCompositionRecorder({
  onSave,
  onTransform,
  native = false,
  beforeSubmit,
}: {
  onSave: (file: File) => Promise<void>;
  onTransform?: (file: File, soundKind?: AudioTranscriptionMode) => Promise<void>;
  native?: boolean;
  beforeSubmit?: () => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const discardOnStop = useRef(false);
  const nativeStartedAt = useRef<number | null>(null);
  const mounted = useRef(true);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [soundKind, setSoundKind] = useState<AudioTranscriptionMode>("AUTO");
  const [pendingLabel, setPendingLabel] = useState("처리 중");
  const [file, setFile] = useState<File | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      // Leaving the page discards an unfinished app recording.
      if (nativeStartedAt.current !== null) void recordNativeAudio("cancel").catch(() => {});
      nativeStartedAt.current = null;
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function toggleNative() {
    if (recording) {
      const startedAt = nativeStartedAt.current;
      nativeStartedAt.current = null;
      setRecording(false);
      setPending(true);
      try {
        const recorded = await recordNativeAudio("stop");
        if (!mounted.current) return;
        setFile(recorded);
        setUrl(recorded ? URL.createObjectURL(recorded) : "");
        setDurationMs(recorded && startedAt !== null ? Date.now() - startedAt : null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "녹음을 저장하지 못했습니다.");
      } finally {
        setPending(false);
      }
      return;
    }
    setPending(true);
    setError("");
    setFile(null);
    setUrl("");
    setDurationMs(null);
    try {
      await recordNativeAudio("start");
      if (!mounted.current) {
        void recordNativeAudio("cancel").catch(() => {});
        return;
      }
      nativeStartedAt.current = Date.now();
      setRecording(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "마이크 권한을 확인해 주세요.");
    } finally {
      setPending(false);
    }
  }
  async function toggle() {
    if (native) return toggleNative();
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      setLiveStream(null);
      return;
    }
    setPending(true);
    setError("");
    setFile(null);
    setUrl("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("이 브라우저에서는 녹음을 사용할 수 없습니다.");
      }
      discardOnStop.current = false;
      // Echo cancellation suppresses any metronome audio from bleeding into the microphone track.
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.current = nextStream;
      const next = new MediaRecorder(nextStream);
      recorder.current = next;
      const chunks: BlobPart[] = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        nextStream.getTracks().forEach((track) => track.stop());
        if (discardOnStop.current) {
          discardOnStop.current = false;
          return;
        }
        const type = next.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "mp4" : "webm";
        const recorded = new File(chunks, `recording.${extension}`, { type });
        setFile(recorded);
        setUrl(URL.createObjectURL(recorded));
      };
      next.start();
      setLiveStream(nextStream);
      setRecording(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "마이크 권한을 확인해 주세요.");
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!file || pending) return;
    setPendingLabel("저장 중");
    setPending(true);
    setError("");
    // The chooser auditions the recording itself; the native player must not play over it.
    beforeSubmit?.();
    try {
      await onSave(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "녹음을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }
  async function transform() {
    if (!file || pending || !onTransform) return;
    setPendingLabel("소리 분석 및 MIDI 변환 중");
    setPending(true);
    setError("");
    beforeSubmit?.();
    try {
      await onTransform(file, soundKind);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "녹음을 MIDI로 변환하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }
  function reset() {
    if (pending) return;
    beforeSubmit?.();
    if (native) {
      if (recording || nativeStartedAt.current !== null) {
        nativeStartedAt.current = null;
        setRecording(false);
        void recordNativeAudio("cancel").catch(() => {});
      }
    } else {
      if (recorder.current?.state === "recording") {
        discardOnStop.current = true;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      setLiveStream(null);
      setRecording(false);
    }
    setFile(null);
    setDurationMs(null);
    setUrl("");
    setError("");
  }
  return {
    soundKind,
    setSoundKind,
    liveStream,
    recording,
    pending,
    file,
    durationMs,
    url,
    error,
    /** The status line under the recorder. */
    status: recording ? "녹음 중" : pending ? pendingLabel : file ? "녹음 완료" : "",
    toggle,
    reset,
    save,
    transform,
  };
}

export function CompositionRecordScreen({
  onSave,
  onTransform,
  saveLabel = "레이어에 녹음 저장",
  bpm = 120,
  timeSignature,
  signature,
  onTiming,
  timingMode = onTiming ? "editable" : "locked",
}: {
  onSave: (file: File, selection?: AudioSelection) => Promise<void>;
  onTransform?: (
    file: File,
    soundKind?: AudioTranscriptionMode,
    selection?: AudioSelection,
  ) => Promise<void>;
  saveLabel?: string;
  onBack: () => void;
  bpm?: number;
  timeSignature?: string;
  signature?: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
}) {
  const parsedSignature = useMemo(
    () => signature ?? parseSignature(timeSignature ?? "4/4"),
    [signature, timeSignature],
  );
  const formattedSignature = `${parsedSignature.numerator}/${parsedSignature.denominator}`;
  const beatsPerBar = beatsPerBarFromSignature(formattedSignature);

  const [metronomeOn, setMetronomeOn] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const selectionRef = useRef<AudioSelection | undefined>(undefined);
  const previewControlRef = useRef<{ toggle: () => void; stop: () => void } | null>(null);

  const saveWithSelection = useCallback(
    (recordedFile: File) => onSave(recordedFile, selectionRef.current),
    [onSave],
  );
  const transformWithSelection = useMemo(
    () =>
      onTransform
        ? (recordedFile: File, kind?: AudioTranscriptionMode) =>
            onTransform(recordedFile, kind, selectionRef.current)
        : undefined,
    [onTransform],
  );

  const {
    soundKind,
    setSoundKind,
    liveStream,
    recording,
    pending,
    file,
    url,
    error,
    status,
    toggle,
    reset,
    save,
    transform,
  } = useCompositionRecorder({
    onSave: saveWithSelection,
    onTransform: transformWithSelection,
    beforeSubmit: () => {
      previewControlRef.current?.stop();
      setPreviewPlaying(false);
    },
  });

  // Auto-start the metronome when recording begins if toggled ON; keep it strictly isolated from MediaRecorder.
  const { activeBeat } = useMetronome({
    enabled: metronomeOn && recording,
    bpm,
    timeSignature: formattedSignature,
  });

  const recorded = Boolean(url);
  const canRetry = !pending && (recording || recorded);

  return (
    <div className={cn(studioStyles.recordView, sharedStyles.scrollContent)}>
      <CreationTimingBar
        bpm={bpm}
        signature={parsedSignature}
        onTiming={onTiming}
        timingMode={timingMode}
        disabled={recording || pending}
      />

      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto">
        {error && (
          <p role="alert" className="m-0 rounded-[12px] border border-[#ff4d4f]/30 bg-[#ff4d4f]/10 px-3.5 py-2 text-caption text-[#ff9ca8]">
            {error}
          </p>
        )}

        {!recorded ? (
          <div className="my-auto flex w-full flex-col gap-3.5 rounded-[18px] border border-[#32323d] bg-[#1e1e26] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-caption font-semibold text-app-fg">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    recording ? "animate-pulse bg-[#ff4d4f]" : "bg-[#606072]",
                  )}
                  aria-hidden="true"
                />
                <span>{status || "녹음 대기"}</span>
              </span>

              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  metronomeOn
                    ? "border-app-primary/60 bg-app-primary/20 text-[#d8b4fe]"
                    : "border-[#32323d] bg-[#23232a] text-app-muted",
                )}
              >
                <span>
                  {recording && metronomeOn
                    ? "메트로놈 재생 중"
                    : metronomeOn
                      ? "메트로놈 ON · 시작 시 자동 재생"
                      : "메트로놈 OFF"}
                </span>
                {metronomeOn && recording && (
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {Array.from({ length: beatsPerBar }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "size-1.5 rounded-full transition-colors",
                          activeBeat === index
                            ? index === 0
                              ? "bg-white"
                              : "bg-[#c4b5fd]"
                            : "bg-white/25",
                        )}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-0.5 py-1 text-center">
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <strong
                  aria-label={`녹음 경과 시간 ${Math.floor(elapsedMs / 1000)}초`}
                  className="text-[32px] leading-tight font-bold tracking-tight text-white"
                >
                  {formatTrimTime(elapsedMs)}
                </strong>
                <span className="text-body text-app-muted">/ 01:00.0</span>
              </div>
            </div>

            <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-[12px] border border-[#2a2a35] bg-[#14141a]">
              {recording && liveStream ? (
                <RecordingMeter stream={liveStream} onElapsedMs={setElapsedMs} />
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-app-primary/25" />
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 px-4 opacity-40"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 28 }, (_, index) => {
                      const height = 14 + Math.abs(Math.sin((index + 1) * 0.65)) * 42;
                      return (
                        <span
                          key={index}
                          className="w-[3px] rounded-full bg-[#7c3aed]"
                          style={{ height: `${Math.round(height)}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="relative z-[1] rounded-full bg-[#14141a]/85 px-3 py-1 text-caption text-app-muted">
                    아래 녹음 버튼을 눌러 시작하세요
                  </span>
                </>
              )}
            </div>

            <p className="m-0 text-center text-[11px] leading-relaxed text-app-muted">
              메트로놈 소리는 최종 녹음에 포함되지 않습니다 · 이어폰 착용 시 더 깔끔하게 녹음됩니다
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3 rounded-[18px] border border-[#32323d] bg-[#1e1e26] p-4">
            <AudioTrimPicker
              key={url}
              url={url}
              bpm={bpm}
              signature={parsedSignature}
              enableSplice
              hideActions
              hidePreviewButton
              previewControlRef={previewControlRef}
              onSelectionChange={(sel) => {
                selectionRef.current = sel ?? undefined;
              }}
              onPreviewStateChange={setPreviewPlaying}
              onSave={async () => {}}
              saveLabel={saveLabel}
            />
            {file && onTransform && (
              <div className={studioStyles.recordConvert}>
                <span className="font-medium">변환 방식</span>
                <Dropdown<AudioTranscriptionMode>
                  label="변환 방식"
                  className="min-w-[156px]"
                  value={soundKind}
                  disabled={pending}
                  onChange={setSoundKind}
                  options={[
                    { value: "AUTO", label: "자동 판별" },
                    { value: "HUMMING", label: "허밍 · 한 음씩" },
                    { value: "INSTRUMENT", label: "악기 · 화음" },
                  ]}
                />
              </div>
            )}
            {file && (
              <div className={studioStyles.recordActions}>
                {onTransform && (
                  <button
                    type="button"
                    className={buttonVariants({ tone: "secondary" })}
                    disabled={pending}
                    onClick={() => {
                      void transform();
                    }}
                  >
                    MIDI로 변환
                  </button>
                )}
                <button
                  type="button"
                  className={buttonVariants({ tone: "primary" })}
                  disabled={pending}
                  onClick={() => {
                    void save();
                  }}
                >
                  {saveLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Portrait Piano Roll style bottom transport bar */}
      <div className="flex shrink-0 items-start justify-center gap-8 pt-1 pb-1">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={!canRetry}
            aria-label="다시 녹음"
            onClick={() => {
              previewControlRef.current?.stop();
              selectionRef.current = undefined;
              setElapsedMs(0);
              reset();
            }}
            className="grid size-12 place-items-center rounded-full border border-[#32323d] bg-[#23232a] text-app-fg transition-colors hover:border-app-primary disabled:opacity-40"
          >
            <RotateCcw size={20} aria-hidden="true" />
          </button>
          <span className="text-[11px] font-medium text-app-muted">다시 녹음</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {recorded ? (
            <button
              type="button"
              disabled={pending}
              aria-label={previewPlaying ? "일시정지" : "미리 듣기"}
              onClick={() => previewControlRef.current?.toggle()}
              className={cn(studioStyles.recordButton, "bg-app-primary [&_img]:size-7")}
            >
              {previewPlaying ? (
                <span className={sharedStyles.pauseSymbol} />
              ) : (
                <Asset name="play.svg" />
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              aria-label={recording ? "녹음 종료" : "녹음 시작"}
              onClick={() => {
                previewControlRef.current?.stop();
                setPreviewPlaying(false);
                if (!recording) {
                  selectionRef.current = undefined;
                  setElapsedMs(0);
                }
                void toggle();
              }}
              className={cn(
                studioStyles.recordButton,
                recording
                  ? "bg-[#ef4444] ring-4 ring-[#ef4444]/25"
                  : "bg-app-primary shadow-[0_6px_20px_rgba(76,0,229,0.4)] hover:brightness-110",
                pending && "opacity-50",
              )}
            >
              {recording ? (
                <Square size={22} fill="currentColor" aria-hidden="true" />
              ) : (
                <Mic size={26} aria-hidden="true" />
              )}
            </button>
          )}
          <span className="text-[11px] font-medium text-app-fg">
            {recorded ? (previewPlaying ? "일시정지" : "미리 듣기") : recording ? "녹음 종료" : "녹음 시작"}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            aria-label={metronomeOn ? "메트로놈 끄기" : "메트로놈 켜기"}
            aria-pressed={metronomeOn}
            onClick={() => setMetronomeOn((current) => !current)}
            className="grid size-12 place-items-center rounded-full border border-[#32323d] bg-[#23232a] text-[#F2F4F6] transition-colors aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-white disabled:opacity-40"
          >
            <MetronomeIcon size={22} />
          </button>
          <span
            className={cn(
              "text-[11px] font-medium",
              metronomeOn ? "text-[#c4b5fd]" : "text-app-muted",
            )}
          >
            {metronomeOn ? "메트로놈 ON" : "메트로놈 OFF"}
          </span>
        </div>
      </div>
    </div>
  );
}

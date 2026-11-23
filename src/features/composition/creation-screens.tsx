import type { AudioTranscriptionMode } from "@/lib/api/composition";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Dropdown } from "@/components/dropdown";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
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
  saveLabel = "선택 구간을 레이어에 저장",
}: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  saveLabel?: string;
  onBack: () => void;
}) {
  const [selected, select] = useSelectedAudio();
  return (
    <div
      className={cn(
        cn(sharedStyles.uploadView, sharedStyles.scrollContent),
        selected ? " has-audio" : "",
      )}
    >
      <label className={sharedStyles.uploadArea}>
        <Asset name="audio-upload-large.svg" />
        <span>{selected?.file.name || "업로드 파일 선택"}</span>
        <input
          type="file"
          accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (selected) select(selected);
            event.target.value = "";
          }}
        />
      </label>
      {selected && (
        <AudioTrimPicker
          key={selected.url}
          url={selected.url}
          onSave={(selection) => onSave(selected.file, selection)}
          saveLabel={saveLabel}
        />
      )}
    </div>
  );
}

function formatRecordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Horizontal pixels per animation frame; the waveform scrolls at about 120px per second. */
const WAVE_COLUMN_WIDTH = 2;

/** Elapsed time and the live microphone waveform, scrolling from right to left. */
function RecordingMeter({ stream }: { stream: MediaStream }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [seconds, setSeconds] = useState(0);
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
    const color = getComputedStyle(element).color;
    const startedAt = performance.now();
    let previous = startedAt;
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      setSeconds(Math.floor((now - startedAt) / 1000));
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
      const y = (sample: number) => middle - Math.max(-1, Math.min(1, sample)) * (middle - 1);
      context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
      context2d.clearRect(0, 0, width, height);
      context2d.globalAlpha = 0.35;
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
      fill.addColorStop(1, color);
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
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="flex items-center gap-2 text-title font-semibold tabular-nums">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff4d4f]" aria-hidden="true" />
        <span aria-label={`녹음 시간 ${seconds}초`}>{formatRecordingTime(seconds)}</span>
      </span>
      <canvas ref={canvas} className="h-20 w-full text-app-primary" aria-hidden="true" />
    </div>
  );
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
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = nextStream;
      const next = new MediaRecorder(nextStream);
      recorder.current = next;
      const chunks: BlobPart[] = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        nextStream.getTracks().forEach((track) => track.stop());
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
    save,
    transform,
  };
}

// The recorder UI and MediaRecorder lifecycle follow the team's RecordScreen.
export function CompositionRecordScreen({
  onSave,
  onTransform,
  saveLabel = "레이어에 녹음 저장",
  bpm = 120,
  timeSignature = "4/4",
}: {
  onSave: (file: File) => Promise<void>;
  onTransform?: (file: File, soundKind?: AudioTranscriptionMode) => Promise<void>;
  saveLabel?: string;
  onBack: () => void;
  bpm?: number;
  timeSignature?: string;
}) {
  const playback = useRef<HTMLAudioElement>(null);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const beatsPerBar = beatsPerBarFromSignature(timeSignature);
  const { activeBeat, isAccent } = useMetronome({
    enabled: metronomeOn && !previewPlaying,
    bpm,
    timeSignature,
  });
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
    save,
    transform,
  } = useCompositionRecorder({
    onSave,
    onTransform,
    beforeSubmit: () => {
      playback.current?.pause();
      setPreviewPlaying(false);
    },
  });
  // A finished take shows the preview, conversion mode and actions; shrink the metronome to make room.
  const recorded = Boolean(url);
  return (
    <div className={cn(studioStyles.recordView, sharedStyles.scrollContent)}>
      <div
        className={cn(
          "flex flex-col items-center gap-3 [.design-canvas_&]:absolute",
          recorded ? "[.design-canvas_&]:top-16" : "[.design-canvas_&]:top-24",
        )}
      >
        <button
          type="button"
          aria-label={metronomeOn ? "메트로놈 끄기" : "메트로놈 켜기"}
          aria-pressed={metronomeOn}
          onClick={() => setMetronomeOn((current) => !current)}
          className={cn(
            "relative flex flex-col items-center rounded-[24px] p-3 transition-transform duration-100",
            metronomeOn
              ? "bg-app-primary/15 ring-2 ring-app-primary/70"
              : "opacity-65 hover:opacity-90",
            metronomeOn && activeBeat !== null && (isAccent ? "scale-105" : "scale-[1.02]"),
          )}
        >
          <Asset
            name="metronome-large.svg"
            className={cn(
              "object-contain [filter:invert(22%)_sepia(95%)_saturate(7000%)_hue-rotate(256deg)]",
              recorded ? "h-24 w-[75px]" : "h-[144px] w-28",
            )}
          />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#32323d] bg-[#1e1e26] px-3 py-1 text-caption">
          <span className="font-semibold tabular-nums text-app-fg">
            {bpm} BPM · {timeSignature}
          </span>
          <span className={metronomeOn ? "font-semibold text-[#c4b5fd]" : "text-app-muted"}>
            {metronomeOn ? "메트로놈 켜짐" : "메트로놈 눌러 켜기"}
          </span>
          {metronomeOn && (
            <span className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: beatsPerBar }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    activeBeat === index
                      ? index === 0
                        ? "bg-white"
                        : "bg-[#a78bfa]"
                      : "bg-[#3f3e4a]",
                  )}
                />
              ))}
            </span>
          )}
        </div>
      </div>
      <div className={cn(studioStyles.recordOutput, recorded && studioStyles.recordOutputRecorded)}>
        {error && <p role="alert">{error}</p>}
        {url && (
          <audio
            ref={playback}
            controls
            src={url}
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onEnded={() => setPreviewPlaying(false)}
          />
        )}
        {recording && liveStream && <RecordingMeter stream={liveStream} />}
        <p role="status">{status}</p>
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
                className={buttonVariants({
                  tone: "secondary",
                })}
                disabled={pending}
                onClick={() => {
                  void transform();
                }}
              >
                MIDI로 변환
              </button>
            )}
            <button
              className={buttonVariants({
                tone: "primary",
              })}
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
      <button
        className={studioStyles.recordButton}
        disabled={pending}
        aria-label={recording ? "녹음 종료" : "녹음 시작"}
        onClick={() => {
          // A new take unmounts the preview <audio> before its pause/ended events can clear the flag
          // that silences the metronome, so stop the preview here.
          playback.current?.pause();
          setPreviewPlaying(false);
          void toggle();
        }}
      >
        {recording ? (
          // Same 82px light disc as record-start.svg; the design canvas makes the button itself transparent.
          <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true">
            <circle cx="41" cy="41" r="41" fill="#F2F4F6" />
            <rect x="29" y="29" width="24" height="24" rx="4" fill="#1D1D1D" />
          </svg>
        ) : (
          <Asset name="record-start.svg" />
        )}
      </button>
    </div>
  );
}

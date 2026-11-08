import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";

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

// The file selection and preview follow the team's UploadScreen; saving is wired to the project API.
export function CompositionUploadScreen({
  onSave,
  saveLabel = "선택 구간을 레이어에 저장",
}: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  saveLabel?: string;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  useEffect(
    () => () => {
      if (selected) URL.revokeObjectURL(selected.url);
    },
    [selected],
  );
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
            if (selected) setSelected({ file: selected, url: URL.createObjectURL(selected) });
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
      if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio);
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
      highs.forEach((sample, index) => context2d.lineTo(x(index), Math.min(middle - 0.75, y(sample))));
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

// The recorder UI and MediaRecorder lifecycle follow the team's RecordScreen.
export function CompositionRecordScreen({
  onSave,
  onTransform,
  saveLabel = "레이어에 녹음 저장",
}: {
  onSave: (file: File) => Promise<void>;
  onTransform?: (file: File) => Promise<void>;
  saveLabel?: string;
  onBack: () => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const playback = useRef<HTMLAudioElement>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("처리 중");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function toggle() {
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
    playback.current?.pause();
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
    setPendingLabel("HTI 변환 중");
    setPending(true);
    setError("");
    playback.current?.pause();
    try {
      await onTransform(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "녹음을 MIDI로 변환하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={cn(studioStyles.recordView, sharedStyles.scrollContent)}>
      <Asset name="metronome-large.svg" className={studioStyles.recordSymbol} />
      <div className={studioStyles.recordOutput}>
        {error && <p role="alert">{error}</p>}
        {url && <audio ref={playback} controls src={url} />}
        {recording && liveStream && <RecordingMeter stream={liveStream} />}
        <p role="status">
          {recording ? "녹음 중" : pending ? pendingLabel : file ? "녹음 완료" : ""}
        </p>
        {file && (
          <div className={studioStyles.recordActions}>
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
                HTI로 MIDI 변환
              </button>
            )}
          </div>
        )}
      </div>
      <button
        className={studioStyles.recordButton}
        disabled={pending}
        aria-label={recording ? "녹음 종료" : "녹음 시작"}
        onClick={() => {
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

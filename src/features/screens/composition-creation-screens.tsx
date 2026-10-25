"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";

export type CreationMethod = "upload" | "record" | "note";

// The three-card selection layout comes from the team's origin/fix/overall ChooseScreen.
export function CompositionChoiceScreen({ onChoose, busy, error }: {
  onChoose: (method: CreationMethod) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  return <div className="choose-view scroll-content">

    {error && <p role="alert">{error}</p>}
    {([
      { method: "upload", label: "업로드", description: "오디오 파일을 불러와 레이어로 추가합니다.", image: "choose-upload.png" },
      { method: "record", label: "녹음", description: "연주나 목소리를 직접 녹음합니다.", image: "choose-record.png" },
      { method: "note", label: "피아노롤", description: "노트를 배치해 멜로디를 만듭니다.", image: "choose-piano.png" },
    ] as const).map((item) => <button className="creation-choice" key={item.method}
      disabled={busy} onClick={() => onChoose(item.method)}>
      <span className="creation-choice-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
      {item.method==="note"?<div className="creation-piano-preview" aria-hidden="true"><span className="creation-piano-keys"/>{Array.from({length:6},(_,index)=><i key={index}/>)}</div>:<Asset name={item.image} />}
    </button>)}
  </div>;
}

// The file selection and preview follow the team's UploadScreen; saving is wired to the project API.
export function CompositionUploadScreen({ onSave,saveLabel="선택 구간을 레이어에 저장" }: {
  onSave: (file: File, selection: AudioSelection) => Promise<void>;
  saveLabel?:string;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  return <div className={`upload-view scroll-content${selected ? " has-audio" : ""}`}>

    <label className="upload-area"><Asset name="audio-upload-large.svg" /><span>{selected?.file.name || "업로드 파일 선택"}</span>
      <input type="file" accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          if (selected) setSelected({ file: selected, url: URL.createObjectURL(selected) });
          event.target.value = "";
        }} />
    </label>
    {selected && <AudioTrimPicker key={selected.url} url={selected.url}
      onSave={(selection) => onSave(selected.file, selection)} saveLabel={saveLabel} />}
  </div>;
}

// The recorder UI and MediaRecorder lifecycle follow the team's RecordScreen.
export function CompositionRecordScreen({ onSave, onTransform,saveLabel="레이어에 녹음 저장" }: {
  onSave: (file: File) => Promise<void>;
  onTransform?: (file: File) => Promise<void>;
  saveLabel?:string;
  onBack: () => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("처리 중");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function toggle() {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    setPending(true); setError(""); setFile(null); setUrl("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("이 브라우저에서는 녹음을 사용할 수 없습니다.");
      }
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = nextStream;
      const next = new MediaRecorder(nextStream);
      recorder.current = next;
      const chunks: BlobPart[] = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        nextStream.getTracks().forEach((track) => track.stop());
        const type = next.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "mp4" : "webm";
        const recorded = new File(chunks, `recording.${extension}`, { type });
        setFile(recorded); setUrl(URL.createObjectURL(recorded));
      };
      next.start(); setRecording(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "마이크 권한을 확인해 주세요.");
    } finally { setPending(false); }
  }
  async function save() {
    if (!file || pending) return;
    setPendingLabel("저장 중"); setPending(true); setError("");
    try { await onSave(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "녹음을 저장하지 못했습니다."); }
    finally { setPending(false); }
  }
  async function transform() {
    if (!file || pending || !onTransform) return;
    setPendingLabel("HTI 변환 중"); setPending(true); setError("");
    try { await onTransform(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "녹음을 MIDI로 변환하지 못했습니다."); }
    finally { setPending(false); }
  }
  return <div className="record-view scroll-content">

    <Asset name="metronome-large.svg" className="record-symbol" />
    <div className="record-output">
      {error && <p role="alert">{error}</p>}
      {url && <audio controls src={url} />}
      <p role="status">{recording ? "녹음 중" : pending ? pendingLabel : file ? "녹음 완료" : ""}</p>
      {file && <div className="record-actions">
        <button className="purple-pill" disabled={pending} onClick={() => { void save(); }}>{saveLabel}</button>
        {onTransform&&<button className="gray-pill" disabled={pending} onClick={() => { void transform(); }}>HTI로 MIDI 변환</button>}
      </div>}
    </div>
    <button className="record-button" disabled={pending} aria-label={recording ? "녹음 종료" : "녹음 시작"}
      onClick={() => { void toggle(); }}>{recording ? "■" : <Asset name="record-start.svg" />}</button>
  </div>;
}

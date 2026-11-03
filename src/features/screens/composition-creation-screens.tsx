"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import { AudioTrimPicker } from "@/features/composition/audio-trim-picker";
import type { AudioSelection } from "@/features/composition/prepare-audio-file";
import { InstrumentPicker } from "@/features/composition/instrument-picker";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";

export type CreationMethod = "upload" | "record" | "note";

// The three-card selection layout comes from the team's origin/fix/overall ChooseScreen.
export function CompositionChoiceScreen({ onChoose, onBack }: {
  onChoose: (method: CreationMethod) => void;
  onBack: () => void;
}) {
  return <div className="choose-view scroll-content">
    <button className="creation-back" onClick={onBack}>← 작곡 화면</button>
    <p className="creation-flow-hint">먼저 만드는 방식을 골라 주세요.<br />악기는 피아노롤에서, 녹음·파일의 역할은 소리를 확인한 뒤 선택합니다.</p>
    {([
      { method: "upload", label: "업로드", image: "choose-upload.png" },
      { method: "record", label: "녹음", image: "choose-record.png" },
      { method: "note", label: "노트로 작곡", image: "choose-piano.png" },
    ] as const).map((item) => <button className="creation-choice" key={item.method}
      onClick={() => onChoose(item.method)}>
      <strong>{item.label}</strong><Asset name={item.image} />
    </button>)}
  </div>;
}

// The file selection and preview follow the team's UploadScreen; saving is wired to the project API.
export function CompositionUploadScreen({ projectId, onSave, onBack }: {
  projectId: number;
  onSave: (file: File, selection: AudioSelection, instrument: string) => Promise<void>;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  const [partSelection, setPartSelection] = useState<AudioSelection | null>(null);
  const preview = useCompositionPlayback(null);
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  return <div className="upload-view scroll-content">
    <button className="creation-back" onClick={onBack}>← 다른 방식 선택</button>
    <label className="upload-area"><span>{selected?.file.name || "오디오 파일 선택"}</span>
      <input type="file" accept="audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/flac"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          if (selected) setSelected({ file: selected, url: URL.createObjectURL(selected) });
          event.target.value = "";
        }} />
    </label>
    {selected && <AudioTrimPicker key={selected.url} url={selected.url}
      onSave={async selection => { setPartSelection(selection); }} saveLabel="다음 · 악기/보컬 선택" />}
    {selected && partSelection && <InstrumentPicker projectId={projectId} mode="audio"
      audio={{ url: selected.url, startMs: partSelection.startMs, endMs: partSelection.endMs }}
      onPreview={preview.previewInstrument} onStop={preview.pause} onClose={() => setPartSelection(null)}
      onConfirm={instrument => onSave(selected.file, partSelection, instrument)} />}
  </div>;
}

// The recorder UI and MediaRecorder lifecycle follow the team's RecordScreen.
export function CompositionRecordScreen({ projectId, onSave, onTransform, onBack }: {
  projectId: number;
  onSave: (file: File, instrument: string) => Promise<void>;
  onTransform: (file: File, instrument: string) => Promise<void>;
  onBack: () => void;
}) {
  const [selectingPart, setSelectingPart] = useState<"audio" | "midi" | null>(null);
  const preview = useCompositionPlayback(null);
  const recordedAudio = useRef<HTMLAudioElement>(null);
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
  async function confirmPart(instrument: string) {
    if (!file || pending || !selectingPart) return;
    setPendingLabel(selectingPart === "midi" ? "HTI 변환 중" : "저장 중"); setPending(true); setError("");
    try { if (selectingPart === "midi") await onTransform(file, instrument); else await onSave(file, instrument); }
    finally { setPending(false); }
  }
  return <div className="record-view scroll-content">
    <button className="creation-back" onClick={onBack}>← 다른 방식 선택</button>
    <Asset name="metronome-big.svg" className="record-symbol" />
    <div className="record-output">
      {error && <p role="alert">{error}</p>}
      {url && <audio ref={recordedAudio} controls src={url} />}
      <p role="status">{recording ? "녹음 중" : pending ? pendingLabel : file ? "녹음 완료" : "버튼을 눌러 녹음하기"}</p>
      {file && <div className="record-actions">
        <button className="purple-pill" disabled={pending} onClick={() => { recordedAudio.current?.pause(); setSelectingPart("audio"); }}>다음 · 악기/보컬 선택</button>
        <button className="gray-pill" disabled={pending} onClick={() => { recordedAudio.current?.pause(); setSelectingPart("midi"); }}>노트로 변환할 악기 선택 (HTI)</button>
      </div>}
    </div>
    {selectingPart && file && <InstrumentPicker projectId={projectId} mode={selectingPart} pitchedOnly={selectingPart === "midi"}
      audio={selectingPart === "audio" ? { url, startMs: 0 } : undefined}
      onPreview={preview.previewInstrument} onStop={preview.pause} onClose={() => setSelectingPart(null)} onConfirm={confirmPart} />}
    <button className="record-button" disabled={pending} aria-label={recording ? "녹음 종료" : "녹음 시작"}
      onClick={() => { void toggle(); }}>{recording ? "■" : <Asset name="play.svg" />}</button>
  </div>;
}

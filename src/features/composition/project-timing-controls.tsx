"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { timeSignatures, type MusicalTiming } from "./musical-time";

export function ProjectTimingControls({ value, editable, disabled, onApply }: {
  value: MusicalTiming; editable: boolean; disabled: boolean; onApply: (timing: MusicalTiming) => Promise<void>;
}) {
  const [bpm, setBpm] = useState(String(value.bpm));
  const [meter, setMeter] = useState(`${value.timeSignatureNumerator}/${value.timeSignatureDenominator}`);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const initialMeter = `${value.timeSignatureNumerator}/${value.timeSignatureDenominator}`;
  const changed = bpm !== String(value.bpm) || meter !== initialMeter;
  const blocked = !editable || disabled || saving;
  async function apply(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || !changed) return;
    const tempo = Number(bpm);
    if (!Number.isInteger(tempo) || tempo < 30 || tempo > 300) {
      setFailed(true); setFeedback("BPM은 30~300 사이의 정수를 입력해 주세요."); return;
    }
    const [timeSignatureNumerator, timeSignatureDenominator] = meter.split("/").map(Number);
    setSaving(true); setFeedback(""); setFailed(false);
    try {
      await onApply({ bpm: tempo, timeSignatureNumerator, timeSignatureDenominator });
      setFeedback("곡 전체 설정을 저장했어요.");
    } catch (cause) {
      setFailed(true); setFeedback(cause instanceof Error ? cause.message : "곡 설정을 저장하지 못했습니다.");
    } finally { setSaving(false); }
  }
  return <form className="project-timing-form" aria-label="곡 설정" onSubmit={event => { void apply(event); }}>
    <div className="parameter-row">
      <label className="parameter tempo"><span className="param-icon" aria-hidden="true">♩</span><span>템포</span>
        <input aria-label="곡 BPM" type="number" inputMode="numeric" min={30} max={300} step={1} required value={bpm}
          disabled={blocked} onChange={event => { setBpm(event.target.value); setFeedback(""); }} /><span className="muted">BPM</span></label>
      <label className="parameter meter"><Music2 aria-hidden="true" /><span>박자표</span>
        <select aria-label="곡 박자표" value={meter} disabled={blocked} onChange={event => { setMeter(event.target.value); setFeedback(""); }}>
          {[...new Set([initialMeter,...timeSignatures])].map(signature => <option key={signature} value={signature}>{signature}</option>)}
        </select></label>
      {editable && <button className="timing-apply" type="submit" disabled={blocked || !changed}>{saving ? "저장 중…" : "적용"}</button>}
    </div>
    <p className="project-settings">곡 전체 설정 · {editable ? "원곡자만 변경할 수 있어요" : "원곡자만 수정 가능 · 완료된 곡은 변경할 수 없어요"}</p>
    {feedback && <p className={`timing-feedback ${failed ? "failed" : ""}`} role={failed ? "alert" : "status"}>{feedback}</p>}
  </form>;
}

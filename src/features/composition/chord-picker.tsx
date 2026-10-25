"use client";

import { useState } from "react";
import { chordPitches, chordQualities, chordRoots, type ChordQuality } from "./chord-input";

const octaves = Array.from({ length: 10 }, (_, index) => index - 1);
const pitchLabel = (pitch: number) => `${chordRoots[pitch % 12].name}${Math.floor(pitch / 12) - 1}`;

export function ChordPicker({ disabled, onAdd }: {
  disabled: boolean;
  onAdd: (rootPitch: number, quality: ChordQuality, name: string) => string;
}) {
  const [quality, setQuality] = useState<ChordQuality>("major");
  const [octave, setOctave] = useState(4);
  const [status, setStatus] = useState("");
  const selected = chordQualities.find((item) => item.id === quality)!;

  return <section className="chord-picker" aria-label="코드로 추가">
    <div className="chord-picker-controls">
      <strong>코드로 추가</strong>
      <label>종류<select aria-label="코드 종류" value={quality} disabled={disabled}
        onChange={(event) => { setQuality(event.target.value as ChordQuality); setStatus(""); }}>
        {chordQualities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <label>옥타브<select aria-label="코드 옥타브" value={octave} disabled={disabled}
        onChange={(event) => { setOctave(Number(event.target.value)); setStatus(""); }}>
        {octaves.map((value) => <option key={value} value={value}>{value}</option>)}
      </select></label>
    </div>
    <div className="chord-picker-buttons">
      {chordRoots.map((root, index) => {
        const rootPitch = (octave + 1) * 12 + index;
        const pitches = chordPitches(rootPitch, quality);
        const name = `${root.name}${selected.suffix}`;
        const alternate = root.alternate ? `${root.alternate}${selected.suffix}` : "";
        const description = pitches.length ? pitches.map(pitchLabel).join(" · ") : "지원 음역을 벗어납니다";
        return <button type="button" key={root.name} disabled={disabled || !pitches.length}
          aria-label={`${name} 코드 추가${alternate ? ` (${alternate})` : ""}`}
          title={`${name}: ${description}`}
          onClick={() => setStatus(onAdd(rootPitch, quality, name))}>
          <span>{name}</span>{alternate && <small>{alternate}</small>}
        </button>;
      })}
    </div>
    <p className="chord-picker-hint">코드를 누르면 현재 재생 위치의 칸에 위에서 선택한 길이로 음이 함께 추가됩니다.</p>
    <p className="chord-picker-status" role="status" aria-live="polite">{status}</p>
  </section>;
}

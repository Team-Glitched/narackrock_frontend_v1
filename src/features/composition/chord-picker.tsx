"use client";

import { useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { chordPitches, chordQualities, chordRoots, type ChordQuality } from "./chord-input";

const octaves = Array.from({ length: 10 }, (_, index) => index - 1);
const pitchLabel = (pitch: number) => `${chordRoots[pitch % 12].name}${Math.floor(pitch / 12) - 1}`;

export function ChordPicker({ disabled, lengthCells, onLengthChange, onOpen, onAdd }: {
  disabled: boolean;
  lengthCells: number;
  onLengthChange: (value: number) => void;
  onOpen: () => void;
  onAdd: (rootPitch: number, quality: ChordQuality, name: string) => { added: boolean; message: string };
}) {
  const [open, setOpen] = useState(false);
  const [octave, setOctave] = useState(4);
  const [status, setStatus] = useState("");
  const groups = useRef<(HTMLHeadingElement | null)[]>([]);

  return <Dialog open={open && !disabled} onOpenChange={(next) => {
    setOpen(next);
    if (next) { setStatus(""); onOpen(); }
  }}>
    <DialogTrigger asChild>
      <button className="studio-chord-trigger" type="button" disabled={disabled}>코드로 추가</button>
    </DialogTrigger>
    <span className="sr-only" role="status">{!open && status}</span>
    <DialogContent className="chord-dialog" showCloseButton={false}>
      <div className="chord-dialog-heading">
        <DialogTitle>코드로 추가</DialogTitle>
        <DialogDescription>근음별로 모아 둔 코드를 선택하면 현재 재생 위치에 구성음이 함께 입력됩니다.</DialogDescription>
        <DialogClose asChild><button className="chord-dialog-close" type="button" aria-label="코드 선택 닫기">×</button></DialogClose>
      </div>
      <div className="chord-dialog-controls">
        <label>옥타브<select aria-label="코드 옥타브" value={octave}
          onChange={(event) => { setOctave(Number(event.target.value)); setStatus(""); }}>
          {octaves.map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label>노트 길이<select aria-label="코드 노트 길이" value={lengthCells}
          onChange={(event) => { onLengthChange(Number(event.target.value)); setStatus(""); }}>
          <option value={1}>1/8</option><option value={2}>1/4</option><option value={4}>1/2</option><option value={8}>한 마디</option>
        </select></label>
      </div>
      <nav className="chord-root-navigation" aria-label="근음 바로가기">
        {chordRoots.map((root, index) => <button type="button" key={root.name} aria-label={`${root.name} 근음으로 이동`}
          onClick={() => {
            groups.current[index]?.focus({ preventScroll: true });
            groups.current[index]?.scrollIntoView({ block: "start" });
          }}>{root.name}{root.alternate && <small> / {root.alternate}</small>}</button>)}
      </nav>
      <div className="chord-group-list">
        {chordRoots.map((root, index) => <section className="chord-root-group" key={root.name} aria-label={`${root.name} 근음 코드`}>
          <h3 tabIndex={-1} ref={(node) => { groups.current[index] = node; }}>
            {root.name}{root.alternate && <small>{root.alternate}</small>}
          </h3>
          <div className="chord-group-buttons">
            {chordQualities.map((quality) => {
              const rootPitch = (octave + 1) * 12 + index;
              const pitches = chordPitches(rootPitch, quality.id);
              const name = `${root.name}${quality.suffix}`;
              const alternate = root.alternate ? `${root.alternate}${quality.suffix}` : "";
              const description = pitches.length ? pitches.map(pitchLabel).join(" · ") : "지원 음역을 벗어납니다";
              return <button type="button" key={quality.id} disabled={disabled || !pitches.length}
                aria-label={`${name} 코드 추가${alternate ? ` (${alternate})` : ""}`}
                title={`${quality.label}: ${description}`}
                onClick={() => {
                  const result = onAdd(rootPitch, quality.id, name);
                  setStatus(result.message);
                  if (result.added) setOpen(false);
                }}>{name}</button>;
            })}
          </div>
        </section>)}
      </div>
      {status && <p className="chord-dialog-status" role="alert">{status}</p>}
    </DialogContent>
  </Dialog>;
}

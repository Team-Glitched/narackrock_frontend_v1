"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { drumNames } from "@/features/composition/instrument-catalog";

const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const allPitches = Array.from({ length: 128 }, (_, row) => 127 - row);
const cellWidth = 21;
const rowHeight = 30;

// Adapted from the team's origin/fix/overall NoteEditorScreen: rows, ruler,
// pointer drag, edge resize, keyboard movement, and keyboard resize.
export function TeamPianoRoll({ notes, setNotes, stepTick, maxTick, lengthCells, editable,
  positionMs, maxDurationMs, onSeek, initialPitch, percussion = false }: {
  notes: MidiNoteDto[];
  setNotes: Dispatch<SetStateAction<MidiNoteDto[]>>;
  stepTick: number;
  maxTick: number;
  lengthCells: number;
  editable: boolean;
  positionMs: number;
  maxDurationMs: number;
  onSeek: (ms: number) => void;
  initialPitch: number;
  percussion?: boolean;
}) {
  const pitches = percussion ? Array.from({ length: 47 }, (_, row) => 81 - row) : allPitches;
  const pitchLabel = (pitch: number) => percussion
    ? drumNames[pitch] ?? `퍼커션 ${pitch}`
    : `${pitchNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const columns = Math.ceil(maxTick / stepTick);
  const width = columns * cellWidth;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number;
    row: number | null; cellLeft: number; moved: boolean } | null>(null);
  const drag = useRef<{ index: number; x: number; y: number; row: number; col: number; durationCells: number; resizing: boolean } | null>(null);
  const [preview, setPreview] = useState<{ index: number; row: number; col: number } | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (workspace) workspace.scrollTop = ((percussion ? 81 : 127) - initialPitch) * rowHeight - (workspace.clientHeight - 30) / 2;
  }, [initialPitch, percussion]);

  function overlaps(current: MidiNoteDto[], index: number, pitch: number, startTick: number, durationTick: number) {
    return current.some((note, other) => other !== index && note.pitch === pitch
      && startTick < note.startTick + note.durationTick && startTick + durationTick > note.startTick);
  }
  function move(index: number, row: number, col: number) {
    setNotes((current) => {
      const note = current[index]; if (!note) return current;
      const pitch = pitches[Math.max(0, Math.min(pitches.length - 1, row))];
      const startTick = Math.max(0, Math.min(maxTick - note.durationTick, col * stepTick));
      if (overlaps(current, index, pitch, startTick, note.durationTick)) return current;
      return current.map((item, position) => position === index ? { ...item, pitch, startTick } : item);
    });
  }
  function resize(index: number, cells: number) {
    setNotes((current) => {
      const note = current[index]; if (!note) return current;
      const durationTick = Math.max(stepTick, Math.min(maxTick - note.startTick, cells * stepTick));
      if (overlaps(current, index, note.pitch, note.startTick, durationTick)) return current;
      return current.map((item, position) => position === index ? { ...item, durationTick } : item);
    });
  }
  function add(row: number, col: number) {
    if (!editable) return;
    const pitch = pitches[row];
    const startTick = col * stepTick;
    const durationTick = Math.min(lengthCells * stepTick, maxTick - startTick);
    if (durationTick <= 0) return;
    setNotes((current) => overlaps(current, -1, pitch, startTick, durationTick) ? current
      : [...current, { pitch, startTick, durationTick, velocity: 100, effectType: null, effectParams: {} }]);
  }
  function seek(clientX: number, track: HTMLElement) {
    const bounds = track.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(maxDurationMs, (clientX - bounds.left) / bounds.width * maxDurationMs)));
  }
  const progress = maxDurationMs > 0 ? Math.min(1, positionMs / maxDurationMs) : 0;
  return <div className={`note-workspace team-note-workspace ${percussion ? "drum-workspace" : ""}`} ref={workspaceRef}
    aria-label={percussion ? "드럼 노트 편집기" : "피아노롤, 빈 영역을 위아래로 드래그하여 음역 이동"}
    onPointerDown={(event) => {
      if (event.button !== 0 || (event.target as Element).closest(".piano-note")) return;
      const rowElement = (event.target as Element).closest<HTMLElement>(".piano-row");
      if (!rowElement && !(event.target as Element).closest(".piano-keys")) return;
      event.preventDefault();
      const workspace = event.currentTarget;
      pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        scrollLeft: workspace.scrollLeft, scrollTop: workspace.scrollTop,
        row: rowElement ? Number(rowElement.dataset.row) : null,
        cellLeft: rowElement?.getBoundingClientRect().left ?? 0, moved: false };
      workspace.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const origin = pan.current;
      if (!origin || origin.pointerId !== event.pointerId) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!origin.moved && Math.hypot(dx, dy) < 5) return;
      origin.moved = true;
      event.currentTarget.scrollLeft = origin.scrollLeft - dx;
      event.currentTarget.scrollTop = origin.scrollTop - dy;
    }}
    onPointerUp={(event) => {
      const origin = pan.current;
      if (!origin || origin.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      pan.current = null;
      if (!origin.moved && origin.row !== null) {
        add(origin.row, Math.max(0, Math.min(columns - 1, Math.floor((origin.x - origin.cellLeft) / cellWidth))));
      }
    }}
    onPointerCancel={() => { pan.current = null; }}>
    <div className="note-ruler-corner" />
    <div className="note-ruler" aria-label="피아노롤 눈금자" style={{ gridTemplateColumns: `repeat(${columns}, ${cellWidth}px)`, width }}>
      {Array.from({ length: columns }, (_, index) => <i key={index} className={index % 8 === 0 ? "bar-tick" : ""}>
        {index % 8 === 0 ? index / 8 + 1 : ""}
      </i>)}
      <button className="note-playhead-handle ruler-handle" style={{ left: progress * width - 10 }}
        role="slider" aria-label="재생 위치 이동" aria-valuemin={0} aria-valuemax={maxDurationMs} aria-valuenow={Math.round(positionMs)}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX, event.currentTarget.parentElement!); }}
        onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          onSeek(event.key === "Home" ? 0 : event.key === "End" ? maxDurationMs
            : positionMs + (event.key === "ArrowRight" ? 1 : -1) * maxDurationMs / columns);
        }} />
    </div>
    <div className="piano-keys" style={{ height: pitches.length * rowHeight, gridTemplateRows: `repeat(${pitches.length}, ${rowHeight}px)` }}>
      {pitches.map((pitch) => <div className={`piano-key ${percussion ? "drum-key" : pitchNames[pitch % 12].includes("#") ? "black" : ""}`} key={pitch}>
      <span>{pitchLabel(pitch)}</span>
    </div>)}</div>
    <div className="piano-roll" style={{ width, height: pitches.length * rowHeight, gridTemplateRows: `repeat(${pitches.length}, ${rowHeight}px)` }}>
      {pitches.map((pitch, row) => <div className={`piano-row ${!percussion && pitchNames[pitch % 12].includes("#") ? "sharp-row" : "natural-row"}`}
        style={{ width }} data-row={row} key={pitch}>
        <button className="team-note-cell"
          aria-label={`${pitchLabel(pitch)} 8분음표 추가`}
          disabled={!editable} onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            add(row, Math.max(0, Math.min(columns - 1, Math.floor(progress * columns))));
          }} />
        {notes.map((note, index) => note.pitch !== pitch ? null : <button key={index} className="piano-note"
          style={{ left: note.startTick / stepTick * cellWidth,
            width: Math.max(20, note.durationTick / stepTick * cellWidth - 1),
            transform: preview?.index === index ? `translate(${(preview.col * stepTick - note.startTick) / stepTick * cellWidth}px, ${(preview.row - row) * rowHeight}px)` : undefined }}
          aria-label={`${pitchLabel(pitch)} 노트, 길이 ${Math.round(note.durationTick / stepTick)}칸`}
          title="드래그로 이동 · 오른쪽 끝으로 길이 조절 · Shift+좌우로 길이 조절 · Delete로 삭제"
          disabled={!editable}
          onPointerDown={(event) => {
            event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
            const bounds = event.currentTarget.getBoundingClientRect();
            drag.current = { index, x: event.clientX, y: event.clientY, row, col: Math.round(note.startTick / stepTick),
              durationCells: Math.round(note.durationTick / stepTick),
              resizing: bounds.right - event.clientX <= Math.min(10, bounds.width / 3) };
          }}
          onPointerMove={(event) => {
            const origin = drag.current;
            if (!origin || origin.index !== index || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            if (origin.resizing) { resize(index, Math.round(origin.durationCells + (event.clientX - origin.x) / cellWidth)); return; }
            setPreview({ index, col: Math.max(0, Math.min(columns - 1, origin.col + Math.round((event.clientX - origin.x) / cellWidth))),
              row: Math.max(0, Math.min(pitches.length - 1, origin.row + Math.round((event.clientY - origin.y) / rowHeight))) });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            if (preview?.index === index) move(index, preview.row, preview.col);
            drag.current = null; setPreview(null);
          }}
          onPointerCancel={() => { drag.current = null; setPreview(null); }}
          onKeyDown={(event) => {
            if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
              event.preventDefault(); resize(index, Math.round(note.durationTick / stepTick) + (event.key === "ArrowRight" ? 1 : -1)); return;
            }
            if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault(); setNotes((current) => current.filter((_, position) => position !== index)); return;
            }
            if (event.key.startsWith("Arrow")) {
              event.preventDefault(); move(index, row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0),
                Math.round(note.startTick / stepTick) + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0));
            }
          }} />)}
      </div>)}
    </div>
    <div className="note-playhead" style={{ left: 87 + progress * width, minHeight: pitches.length * rowHeight }} />
  </div>;
}

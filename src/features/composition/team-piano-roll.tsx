import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { MusicalRuler } from "./musical-ruler";
import { defaultSignature, signatureGrid, musicalGridBackground, type TimeSignature } from "./time-signature";
import { pointerAxes, logicalBounds } from "./pointer-coordinates";
import type { MidiNoteDto } from "@/lib/api/composition";

const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const pitches = Array.from({ length: 128 }, (_, row) => 127 - row);

const rowHeight = 30;

// Adapted from the team's origin/fix/overall NoteEditorScreen: rows, ruler,
// pointer drag, edge resize, keyboard movement, and keyboard resize.
export function TeamPianoRoll({ notes, setNotes, stepTick, maxTick, lengthCells, editable,
  positionMs, maxDurationMs, onSeek, initialPitch, onSettings, signature=defaultSignature }: {
  signature?:TimeSignature;
  onSettings?: (index: number) => void;
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
}) {
  const cellWidth = signatureGrid(signature).cellPx;
  const columns = Math.ceil(maxTick / stepTick);
  const width = maxTick / stepTick * cellWidth;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number;
    row: number | null; cellLeft: number; moved: boolean } | null>(null);
  const drag = useRef<{ index: number; x: number; y: number; row: number; col: number; durationCells: number; resizing: boolean } | null>(null);
  const [preview, setPreview] = useState<{ index: number; row: number; col: number } | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (workspace) workspace.scrollTop = Math.max(0,Math.round(((127 - initialPitch) * rowHeight - (workspace.clientHeight - rowHeight) / 2)/rowHeight)*rowHeight);
  }, [initialPitch]);

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
    const bounds = logicalBounds(track);
    onSeek(Math.max(0, Math.min(maxDurationMs, (clientX - bounds.left) / bounds.width * maxDurationMs)));
  }
  const progress = maxDurationMs > 0 ? Math.min(1, positionMs / maxDurationMs) : 0;
  return <div className="note-workspace team-note-workspace" ref={workspaceRef}
    aria-label="피아노롤, 빈 영역을 위아래로 드래그하여 음역 이동"
    onPointerDown={(event) => {
      if (event.button !== 0 || (event.target as Element).closest(".piano-note")) return;
      const rowElement = (event.target as Element).closest<HTMLElement>(".piano-row");
      if (!rowElement && !(event.target as Element).closest(".piano-keys")) return;
      event.preventDefault();
      const workspace = event.currentTarget;
      const point = pointerAxes(workspace, event);
      pan.current = { pointerId: event.pointerId, x: point.x, y: point.y,
        scrollLeft: workspace.scrollLeft, scrollTop: workspace.scrollTop,
        row: rowElement ? Number(rowElement.dataset.row) : null,
        cellLeft: rowElement ? logicalBounds(rowElement).left : 0, moved: false };
      workspace.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const origin = pan.current;
      if (!origin || origin.pointerId !== event.pointerId) return;
      const point = pointerAxes(event.currentTarget, event);
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
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
      <MusicalRuler signature={signature} width={width}/>
      <button className="note-playhead-handle ruler-handle" style={{ left: progress * width - 10 }}
        role="slider" aria-label="재생 위치 이동" aria-valuemin={0} aria-valuemax={maxDurationMs} aria-valuenow={Math.round(positionMs)}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(pointerAxes(event.currentTarget, event).x, event.currentTarget.parentElement!); }}
        onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          onSeek(event.key === "Home" ? 0 : event.key === "End" ? maxDurationMs
            : positionMs + (event.key === "ArrowRight" ? 1 : -1) * maxDurationMs / (maxTick / stepTick));
        }} />
    </div>
    <div className="piano-keys" style={{ height: pitches.length * rowHeight, gridTemplateRows: `repeat(${pitches.length}, ${rowHeight}px)` }}>
      {pitches.map((pitch) => <div className={`piano-key ${pitchNames[pitch % 12].includes("#") ? "black" : ""}`} key={pitch}>
      <span>{pitchNames[pitch % 12]}{Math.floor(pitch / 12) - 1}</span>
    </div>)}</div>
    <div className="piano-roll" style={{ width, height: pitches.length * rowHeight, gridTemplateRows: `repeat(${pitches.length}, ${rowHeight}px)` }}>
      {pitches.map((pitch, row) => <div className={`piano-row ${pitchNames[pitch % 12].includes("#") ? "sharp-row" : "natural-row"}`}
        style={{ width }} data-row={row} key={pitch}>
        <button className="team-note-cell" style={{backgroundImage:musicalGridBackground(signature)}}
          aria-label={`${pitchNames[pitch % 12]}${Math.floor(pitch / 12) - 1} 노트 추가`}
          disabled={!editable} onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            add(row, Math.max(0, Math.min(columns - 1, Math.floor(progress * width / cellWidth))));
          }} />
        {notes.map((note, index) => note.pitch !== pitch ? null : <button key={index} className="piano-note"
          style={{ left: note.startTick / stepTick * cellWidth,
            width: Math.max(1, note.durationTick / stepTick * cellWidth - 1),
            transform: preview?.index === index ? `translate(${(preview.col * stepTick - note.startTick) / stepTick * cellWidth}px, ${(preview.row - row) * rowHeight}px)` : undefined }}
          aria-label={`${pitchNames[pitch % 12]}${Math.floor(pitch / 12) - 1} 노트, 길이 ${Math.round(note.durationTick / stepTick)}칸`}
          title="드래그로 이동 · 오른쪽 끝으로 길이 조절 · Shift+좌우로 길이 조절 · Delete로 삭제"
          disabled={!editable}
          onPointerDown={(event) => {
            event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
            const bounds = logicalBounds(event.currentTarget);
            const point = pointerAxes(event.currentTarget, event);
            drag.current = { index, x: point.x, y: point.y, row, col: Math.round(note.startTick / stepTick),
              durationCells: Math.round(note.durationTick / stepTick),
              resizing: bounds.left + bounds.width - point.x <= Math.min(10, bounds.width / 3) };
          }}
          onPointerMove={(event) => {
            const origin = drag.current;
            if (!origin || origin.index !== index || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const point = pointerAxes(event.currentTarget, event);
            if (origin.resizing) { resize(index, Math.round(origin.durationCells + (point.x - origin.x) / cellWidth)); return; }
            setPreview({ index, col: Math.max(0, Math.min(columns - 1, origin.col + Math.round((point.x - origin.x) / cellWidth))),
              row: Math.max(0, Math.min(pitches.length - 1, origin.row + Math.round((point.y - origin.y) / rowHeight))) });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            const origin = drag.current;
            const point = pointerAxes(event.currentTarget, event);
            const tapped = origin && Math.hypot(point.x - origin.x, point.y - origin.y) < 5;
            if (preview?.index === index) move(index, preview.row, preview.col);
            if (tapped) onSettings?.(index);
            drag.current = null; setPreview(null);
          }}
          onPointerCancel={() => { drag.current = null; setPreview(null); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); onSettings?.(index); return; }
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
          }}>{pitchNames[pitch % 12]}</button>)}
      </div>)}
    </div>
    <div className="note-playhead" style={{ left: 87 + progress * width, minHeight: pitches.length * rowHeight }} />
  </div>;
}

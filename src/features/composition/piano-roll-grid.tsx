"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { meterTiming, rulerBeats } from "./musical-time";
import { drumPadFor, moveDrumNotes } from "./drum-kit";
import { DrumPadIcon } from "./drum-pad-icon";
import { drumNames } from "./instrument-catalog";
import { canPlaceNotes, clamp, moveNotes, pitchName, resizeNotes, type NoteBounds } from "./note-editing";

export type EditorMode = "draw" | "select" | "erase";
type Point = { x: number; y: number; tick: number; pitch: number };
type Gesture = {
  pointer: number; kind: "move" | "resize" | "draw" | "erase" | "box";
  start: Point; clientX: number; clientY: number; moved: boolean; index: number | null;
  before: MidiNoteDto[]; result: MidiNoteDto[]; oldSelection: Set<number>; ids: Set<number>;
};
const rowHeight = 32;

export function PianoRollGrid({ notes, onCommit, selected, onSelect, mode, stepTick, minTick, ppq, timeSignatureNumerator, timeSignatureDenominator, bounds,
  viewStart, visibleTicks, positionTick, onSeek, initialPitch, editable, percussion, pitches, revealNote, onEditStart, onAudition, onViewStart }: {
  notes: MidiNoteDto[]; onCommit: (notes: MidiNoteDto[]) => void;
  selected: Set<number>; onSelect: (selected: Set<number>) => void; mode: EditorMode;
  stepTick: number; minTick: number; ppq: number; timeSignatureNumerator: number; timeSignatureDenominator: number; bounds: NoteBounds; viewStart: number; visibleTicks: number;
  positionTick: number; onSeek: (tick: number) => void; initialPitch: number;
  editable: boolean; percussion: boolean; pitches: number[]; revealNote?: { pitch: number; startTick: number } | null;
  onEditStart: () => void; onAudition: (pitch: number) => void; onViewStart: (tick: number) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; tick: number; top: number } | null>(null);
  const gridId = useId();
  const gesture = useRef<Gesture | null>(null);
  const initialized = useRef<number[] | null>(null);
  const [erased, setErased] = useState(new Set<number>());
  const [preview, setPreview] = useState<MidiNoteDto[] | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const { beatTick, barTick } = meterTiming(ppq, timeSignatureNumerator, timeSignatureDenominator);
  const rowByPitch = useMemo(() => new Map(pitches.map((pitch, row) => [pitch, row])), [pitches]);
  const label = (pitch: number) => percussion ? drumPadFor(pitch)?.label ?? drumNames[pitch] ?? `퍼커션 ${pitch}` : pitchName(pitch);

  useEffect(() => {
    if (initialized.current === pitches || !scroll.current) return;
    scroll.current.scrollTop = percussion && pitches.length === 11 ? 0
      : (rowByPitch.get(initialPitch) ?? 0) * rowHeight - scroll.current.clientHeight / 2;
    initialized.current = pitches;
  }, [initialPitch, pitches, rowByPitch, percussion]);
  useEffect(() => {
    if (scroll.current && revealNote && rowByPitch.has(revealNote.pitch))
      scroll.current.scrollTop = rowByPitch.get(revealNote.pitch)! * rowHeight - scroll.current.clientHeight / 2;
  }, [revealNote, rowByPitch]);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      const delta = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1);
      onViewStart(viewStart + pixels / Math.max(1, grid.current?.clientWidth ?? element.clientWidth) * visibleTicks);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [onViewStart, viewStart, visibleTicks]);

  function touchCenter() {
    const points = [...touches.current.values()];
    return { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
  }

  function point(event: PointerEvent): Point {
    const rect = grid.current!.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    return { x, y, tick: viewStart + x / rect.width * visibleTicks,
      pitch: pitches[clamp(Math.floor(y / rowHeight), 0, pitches.length - 1)] };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (touches.current.size >= 2) {
        const previous = gesture.current;
        if (previous) onSelect(previous.oldSelection);
        gesture.current = null;
        setPreview(null); setMarquee(null); setErased(new Set());
        const center = touchCenter();
        pan.current = { ...center, tick: viewStart, top: scroll.current?.scrollTop ?? 0 };
        onEditStart();
        return;
      }
    }
    if ((!editable && mode !== "select") || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    onEditStart();
    const start = point(event);
    const element = (event.target as Element).closest<HTMLElement>("[data-note-index]");
    const index = element ? Number(element.dataset.noteIndex) : null;
    const g: Gesture = { pointer: event.pointerId, start, clientX: event.clientX, clientY: event.clientY,
      moved: false, index, before: notes, result: notes, oldSelection: new Set(selected), ids: new Set(selected), kind: "box" };
    if (mode === "erase") {
      g.kind = "erase";
      g.ids = new Set(index === null ? [] : [index]);
      setErased(new Set(g.ids));
    } else if (index !== null) {
      g.kind = editable && (event.target as Element).closest("[data-resize]") ? "resize" : "move";
      g.ids = selected.has(index) ? new Set(selected) : new Set([index]);
      onSelect(g.ids);
    } else if (mode === "draw") {
      g.kind = "draw";
      const startTick = clamp(Math.floor(start.tick / stepTick) * stepTick, 0, bounds.maxTick - 1);
      const note = { pitch: start.pitch, startTick, durationTick: Math.min(stepTick, bounds.maxTick - startTick),
        velocity: 100, effectType: null, effectParams: {} };
      if (canPlaceNotes(notes, [note], bounds)) {
        g.index = notes.length; g.result = [...notes, note]; onSelect(new Set([notes.length]));
      }
    } else {
      g.ids = event.shiftKey ? new Set(selected) : new Set();
      setMarquee({ x: start.x, y: start.y, width: 0, height: 0 });
    }
    gesture.current = g;
    setPreview(g.result);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pan.current) {
      if (touches.current.size >= 2) {
        const center = touchCenter();
        onViewStart(pan.current.tick + (pan.current.x - center.x) / Math.max(1, grid.current?.clientWidth ?? 1) * visibleTicks);
        if (scroll.current) scroll.current.scrollTop = pan.current.top + pan.current.y - center.y;
      }
      return;
    }
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) > 5) g.moved = true;
    if (!g.moved || (!editable && (g.kind === "move" || g.kind === "resize"))) return;
    const p = point(event);
    const ticks = Math.round((p.tick - g.start.tick) / stepTick) * stepTick;
    if (g.kind === "move") {
      const rows = Math.round((event.clientY - g.clientY) / rowHeight);
      g.result = percussion ? moveDrumNotes(g.before, g.ids, ticks, rows, pitches, bounds)
        : moveNotes(g.before, g.ids, ticks, -rows, bounds);
    }
    if (g.kind === "resize") g.result = resizeNotes(g.before, g.ids, ticks, minTick, bounds);
    if (g.kind === "draw" && g.index !== null) {
      const note = g.result[g.index];
      const durationTick = clamp(Math.round((p.tick - note.startTick) / stepTick) * stepTick + stepTick,
        Math.min(stepTick, bounds.maxTick - note.startTick), bounds.maxTick - note.startTick);
      const changed = { ...note, durationTick };
      if (canPlaceNotes(g.before, [changed], bounds)) g.result = [...g.before, changed];
    }
    if (g.kind === "erase") {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-note-index]");
      if (target) g.ids.add(Number(target.dataset.noteIndex));
      // Keep original indices while erasing so crossing several notes cannot skip a note.
      g.result = g.before;
      setErased(new Set(g.ids));
    }
    if (g.kind === "box") {
      const box = { x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y),
        width: Math.abs(p.x - g.start.x), height: Math.abs(p.y - g.start.y) };
      setMarquee(box);
      const ids = new Set(g.ids);
      const width = grid.current!.clientWidth;
      notes.forEach((note, index) => {
        const x = (note.startTick - viewStart) / visibleTicks * width;
        const row = rowByPitch.get(note.pitch);
        if (row === undefined) return;
        const y = row * rowHeight + 3;
        if (x < box.x + box.width && x + note.durationTick / visibleTicks * width > box.x
          && y < box.y + box.height && y + 25 > box.y) ids.add(index);
      });
      onSelect(ids);
    }
    setPreview([...g.result]);
  }
  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    touches.current.delete(event.pointerId);
    if (pan.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!touches.current.size) pan.current = null;
      return;
    }
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) onSelect(g.oldSelection);
    else {
      if (g.kind === "erase") { g.result = g.before.filter((_, index) => !g.ids.has(index)); onSelect(new Set()); }
      if (!g.moved && g.kind === "move" && g.index !== null) {
        const ids = new Set(g.oldSelection);
        if (ids.has(g.index)) ids.delete(g.index); else ids.add(g.index);
        onSelect(ids); onAudition(notes[g.index].pitch);
      }
      if (!g.moved && g.kind === "box") { onSelect(new Set()); onSeek(Math.floor(g.start.tick / stepTick) * stepTick); }
      onCommit(g.result);
    }
    setPreview(null); setMarquee(null); setErased(new Set());
  }
  const shown = preview ?? notes;
  const beatTicks = rulerBeats(viewStart, visibleTicks, ppq, timeSignatureNumerator, timeSignatureDenominator);
  const snapTicks = Array.from({ length: Math.ceil(visibleTicks / stepTick) + 1 }, (_, i) => (Math.ceil(viewStart / stepTick) + i) * stepTick)
    .filter(tick => tick < viewStart + visibleTicks);
  const progress = (positionTick - viewStart) / visibleTicks * 100;
  return <>
    <div className="ruler-wrap"><div className="ruler-key">{percussion ? "타악기" : "옥타브"}</div>
      <div className="ruler" role="slider" tabIndex={0} aria-label="재생 위치 이동" aria-valuemin={0}
        aria-valuemax={bounds.maxTick} aria-valuenow={Math.round(positionTick)}
        onPointerDown={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          onSeek(clamp(viewStart + (event.clientX - rect.left) / rect.width * visibleTicks, 0, bounds.maxTick));
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onSeek(clamp(viewStart + (event.clientX - rect.left) / rect.width * visibleTicks, 0, bounds.maxTick));
        }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          onSeek(event.key === "Home" ? 0 : event.key === "End" ? bounds.maxTick
            : clamp(positionTick + (event.key === "ArrowRight" ? stepTick : -stepTick), 0, bounds.maxTick));
        }}>
        {beatTicks.map(({ tick, beat, bar, isBar }) => <span key={tick}>
          {isBar && <span className="bar-label" style={{ left: `${(tick - viewStart) / visibleTicks * 100}%` }}>{String(bar).padStart(2, "0")}</span>}
          <span className="beat-label" style={{ left: `${(tick - viewStart) / visibleTicks * 100}%`, width: `${beatTick / visibleTicks * 100}%` }}>{beat}</span>
        </span>)}
        {progress >= 0 && progress <= 100 && <div className="ruler-head" style={{ left: `${progress}%` }} />}
      </div>
    </div>
    <div className="roll-scroll" ref={scroll}><div className="roll-content">
      <div className="keys" aria-label={percussion ? "드럼 건반" : "피아노 건반"}>
        {pitches.map(pitch => <button key={pitch} className={`key ${!percussion && [1, 3, 6, 8, 10].includes(pitch % 12) ? "black" : ""}`}
          aria-label={`${label(pitch)} 미리 듣기`} title={label(pitch)} onClick={() => onAudition(pitch)}>
          {percussion ? <DrumPadIcon kind={drumPadFor(pitch)?.icon ?? "percussion"} /> : <span>{label(pitch)}</span>}</button>)}
      </div>
      <div className="grid" ref={grid} id={gridId} role="application" tabIndex={0} aria-label={percussion ? "드럼 노트 편집기" : "피아노롤 노트 편집기"}
        aria-disabled={!editable} style={{ height: pitches.length * rowHeight,
          "--step-px": `${stepTick / visibleTicks * 100}%`, cursor: mode === "draw" ? "crosshair" : mode === "erase" ? "cell" : "default" } as CSSProperties}
        onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
        {pitches.map((pitch, i) => <div key={pitch} className={`pitch-row ${!percussion && [1, 3, 6, 8, 10].includes(pitch % 12) ? "dark" : ""}`} style={{ top: i * rowHeight }} />)}
        {snapTicks.map(tick => <div className="snap-line" key={`snap-${tick}`} style={{ left: `${(tick - viewStart) / visibleTicks * 100}%` }} />)}
        {beatTicks.map(({ tick, isBar }) => <div className={`beat-line ${isBar ? "bar" : ""}`} key={tick} style={{ left: `${(tick - viewStart) / visibleTicks * 100}%` }} />)}
        <div className="notes">{shown.map((note, index) => !rowByPitch.has(note.pitch) || note.startTick >= viewStart + visibleTicks || note.startTick + note.durationTick <= viewStart ? null :
          <div key={index} className={`note ${selected.has(index) ? "selected" : ""}`} data-note-index={index}
            role="button" tabIndex={0} aria-label={`${label(note.pitch)}, ${Number((note.durationTick / beatTick).toFixed(2))}박`}
            aria-pressed={selected.has(index)} aria-disabled={!editable}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); const ids = new Set(selected); if (ids.has(index)) ids.delete(index); else ids.add(index); onSelect(ids); } }}
            style={{ visibility: erased.has(index) ? "hidden" : undefined, left: `calc(${(note.startTick - viewStart) / visibleTicks * 100}% + 2px)`,
              width: `calc(${note.durationTick / visibleTicks * 100}% - 4px)`, top: rowByPitch.get(note.pitch)! * rowHeight + 3 }}>
            <span>{label(note.pitch)}</span><i className="resize-handle" data-resize="true" />
          </div>)}</div>
        {progress >= 0 && progress <= 100 && <div className="playhead" style={{ left: `${progress}%` }} />}
        {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}
      </div>
    </div></div>
    <div className="scroll-navigation">
      <span className="scroll-help">가로 스크롤 · Shift+휠 · 두 손가락으로 상하좌우 이동</span>
      <input className="timeline-scrollbar" type="range" min={0} max={Math.max(0, bounds.maxTick - visibleTicks)} step={1}
        value={viewStart} disabled={bounds.maxTick <= visibleTicks} aria-label="피아노롤 가로 스크롤" aria-controls={gridId}
        aria-valuetext={`${Math.floor(viewStart / barTick) + 1}마디부터 ${Math.ceil((viewStart + visibleTicks) / barTick)}마디까지`}
        onChange={event => onViewStart(Number(event.target.value))}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          onViewStart(event.key === "Home" ? 0 : event.key === "End" ? bounds.maxTick - visibleTicks
            : viewStart + (event.key === "ArrowRight" ? beatTick : -beatTick));
        }} />
    </div>
  </>;
}

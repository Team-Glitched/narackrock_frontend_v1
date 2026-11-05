import { studioStyles } from "@/styles/studio.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { MusicalRuler } from "./musical-ruler";
import type { TimeSignature } from "./time-signature";
import type { NoteEditorController } from "./use-note-editor";
import { pointerAxes, logicalBounds } from "./pointer-coordinates";
import { findInstrument } from "./instrument-catalog";
import { drumPadFor } from "./drum-kit";
import { DrumPadIcon } from "./drum-pad-icon";

const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const rowHeight = 30;
const keyWidth = 87;
const rulerHeight = 30;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
type Point = { x: number; y: number };
type Marquee = { left: number; top: number; width: number; height: number };
type Gesture = {
  kind: "draw" | "move" | "resize" | "erase" | "marquee" | "pan" | "tap";
  pointerId: number;
  axes: Point;
  origin: Point;
  previous: Point;
  moved: boolean;
  indices: number[];
  selected: number[];
  notes: MidiNoteDto[];
  erased: Set<number>;
  pitch: number;
  noteIndex: number | null;
  additive: boolean;
  scrollLeft: number;
  scrollTop: number;
};

// Segment/rectangle intersection keeps fast eraser sweeps from skipping narrow notes.
function crossesNote(from: Point, to: Point, left: number, top: number, right: number, bottom: number) {
  let enter = 0;
  let leave = 1;
  for (const [start, delta, low, high] of [
    [from.x, to.x - from.x, left, right], [from.y, to.y - from.y, top, bottom],
  ]) {
    if (delta === 0) {
      if (start < low || start > high) return false;
    } else {
      const a = (low - start) / delta;
      const b = (high - start) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

export function TeamPianoRoll({
  editor, signature, ppq, maxTick, positionTick, onSeekTick, playing,
  instrument, initialPitch, onAudition, onSettings,
}: {
  editor: NoteEditorController;
  signature: TimeSignature;
  ppq: number;
  maxTick: number;
  positionTick: number;
  onSeekTick: (tick: number) => void;
  playing: boolean;
  instrument: string | null;
  initialPitch: number;
  onAudition: (pitch: number) => void;
  onSettings?: (index: number) => void;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const latestEditor = useRef(editor);
  useLayoutEffect(() => {
    latestEditor.current = editor;
  });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const rows = editor.bounds.rows;
  const rowIndices = useMemo(() => new Map(rows.map((pitch, row) => [pitch, row])), [rows]);
  const selected = new Set(editor.selection);
  const drum = findInstrument(instrument)?.kind === "drum";
  const stepTick = editor.bounds.stepTick;
  const windowTicks = editor.windowTicks;
  const pixelsPerTick = windowTicks > 0 ? viewportWidth / windowTicks : 0;
  const width = maxTick * pixelsPerTick;
  const height = rows.length * rowHeight;
  const playheadTick = clamp(positionTick, 0, maxTick);
  const startTick = editor.view.viewStartTick;
  const hiddenCount = drum ? editor.snapshot.notes.filter((note) => !rowIndices.has(note.pitch)).length : 0;
  const pitchLabel = (pitch: number) => drum
    ? drumPadFor(pitch)?.label ?? `타악기 ${pitch}`
    : `${pitchNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

  function releaseCapture(pointerId: number) {
    const workspace = workspaceRef.current;
    if (workspace?.hasPointerCapture(pointerId)) workspace.releasePointerCapture(pointerId);
  }
  /** Drops the active gesture's ref, preview and pointer capture; restores a marquee's prior selection. */
  function abandonGesture() {
    const active = gesture.current;
    gesture.current = null;
    if (active?.kind === "marquee" && active.notes === latestEditor.current.snapshot.notes) {
      latestEditor.current.select(active.selected);
    }
    latestEditor.current.cancelGesture();
    if (active) releaseCapture(active.pointerId);
  }
  function cancel() {
    abandonGesture();
    setMarquee(null);
  }
  const discardGesture = useEffectEvent(cancel);
  const abandonGestureFromEffect = useEffectEvent(abandonGesture);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const measure = () => {
      const logicalWidth = logicalBounds(workspace).width;
      const scrollbarWidth = workspace.offsetWidth - workspace.clientWidth;
      setViewportWidth(Math.max(0, logicalWidth - scrollbarWidth - keyWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (workspace && pixelsPerTick > 0) {
      const target = startTick * pixelsPerTick;
      if (Math.abs(workspace.scrollLeft - target) > 0.5) workspace.scrollLeft = target;
    }
  }, [startTick, pixelsPerTick]);

  const rowKey = rows.join(",");
  const scrollToInitialRow = useEffectEvent(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const pitch = rows.includes(initialPitch) ? initialPitch : drum ? 36 : initialPitch;
    const row = Math.max(0, rows.indexOf(pitch));
    workspace.scrollTop = Math.max(0, row * rowHeight - (workspace.clientHeight - rulerHeight - rowHeight) / 2);
  });
  // Re-centre only when the visible row set or the requested pitch changes, not on every bounds object.
  useLayoutEffect(() => scrollToInitialRow(), [initialPitch, drum, rowKey]);

  const setViewStartTick = editor.setViewStartTick;
  useEffect(() => {
    if (!playing || pixelsPerTick <= 0) return;
    if (playheadTick < startTick || playheadTick >= startTick + windowTicks) {
      setViewStartTick(Math.floor(playheadTick / windowTicks) * windowTicks);
    }
  }, [playing, playheadTick, startTick, windowTicks, pixelsPerTick, setViewStartTick]);

  // Tool, snap, window, row set, size or permission changes invalidate an in-flight gesture.
  const gestureConfig = JSON.stringify([editor.editable, editor.view.tool, editor.view.snapDenominator,
    editor.view.visibleBars, rowKey, viewportWidth, windowTicks, stepTick, maxTick, instrument]);
  const [seenGestureConfig, setSeenGestureConfig] = useState(gestureConfig);
  if (seenGestureConfig !== gestureConfig) {
    setSeenGestureConfig(gestureConfig);
    setMarquee(null);
  }
  useEffect(() => {
    abandonGestureFromEffect();
  }, [gestureConfig]);

  const dropStaleGesture = useEffectEvent(() => {
    const active = gesture.current;
    if (active && (active.notes !== editor.snapshot.notes || (!editor.gestureActive &&
        ["draw", "move", "resize", "erase"].includes(active.kind)))) cancel();
  });
  useEffect(() => {
    dropStaleGesture();
  }, [editor.gestureActive, editor.lastChange]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) {
        event.preventDefault();
        discardGesture();
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
      const active = gesture.current;
      gesture.current = null;
      if (active?.kind === "marquee" && active.notes === latestEditor.current.snapshot.notes) {
        latestEditor.current.select(active.selected);
      }
      latestEditor.current.cancelGesture();
      if (active) releaseCapture(active.pointerId);
    };
  }, []);

  function contentPoint(event: { clientX: number; clientY: number }): Point {
    const roll = rollRef.current!;
    const point = pointerAxes(roll, event);
    const bounds = logicalBounds(roll);
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  }
  function preview(active: Gesture, point: Point) {
    if (active.kind === "draw") {
      const originTick = Math.floor(active.origin.x / pixelsPerTick / stepTick) * stepTick;
      const currentTick = Math.floor(point.x / pixelsPerTick / stepTick) * stepTick;
      const noteStart = Math.max(0, Math.min(originTick, currentTick));
      const noteEnd = Math.min(maxTick, Math.max(originTick, currentTick) + stepTick);
      editor.previewGesture({ type: "insert", notes: [{
        pitch: active.pitch, startTick: noteStart, durationTick: noteEnd - noteStart,
        velocity: 100, effectType: null, effectParams: {},
      }] });
    } else if (active.kind === "move" || active.kind === "resize") {
      const deltaTick = Math.round((point.x - active.origin.x) / pixelsPerTick / stepTick) * stepTick;
      editor.previewGesture(active.kind === "resize"
        ? { type: "resize", indices: active.indices, deltaTick }
        : { type: "move", indices: active.indices, deltaTick,
          deltaRow: Math.round((point.y - active.origin.y) / rowHeight) });
    } else if (active.kind === "erase") {
      active.notes.forEach((note, index) => {
        const row = rowIndices.get(note.pitch);
        if (row !== undefined && crossesNote(active.previous, point,
          note.startTick * pixelsPerTick, row * rowHeight,
          (note.startTick + note.durationTick) * pixelsPerTick, (row + 1) * rowHeight)) {
          active.erased.add(index);
        }
      });
      editor.previewGesture({ type: "delete", indices: [...active.erased] });
    } else if (active.kind === "marquee") {
      const left = clamp(Math.min(active.origin.x, point.x), 0, width);
      const right = clamp(Math.max(active.origin.x, point.x), 0, width);
      const top = clamp(Math.min(active.origin.y, point.y), 0, height);
      const bottom = clamp(Math.max(active.origin.y, point.y), 0, height);
      setMarquee({ left, top, width: right - left, height: bottom - top });
      const hits = active.notes.flatMap((note, index) => {
        const row = rowIndices.get(note.pitch);
        return row !== undefined && row * rowHeight < bottom && (row + 1) * rowHeight > top &&
          note.startTick * pixelsPerTick < right && (note.startTick + note.durationTick) * pixelsPerTick > left
          ? [index] : [];
      });
      editor.select(active.additive ? [...new Set([...active.selected, ...hits])] : hits);
    }
    active.previous = point;
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || gesture.current || pixelsPerTick <= 0) return;
    const target = event.target as Element;
    if (target.closest(".piano-keys, .note-ruler, .note-ruler-corner")) return;
    if (!target.closest(".piano-roll")) return;
    const point = contentPoint(event);
    const row = Math.floor(point.y / rowHeight);
    if (rows[row] === undefined || point.x < 0 || point.x >= width) return;
    const noteElement = target.closest<HTMLButtonElement>("[data-note-index]");
    const noteIndex = noteElement ? Number(noteElement.dataset.noteIndex) : null;
    const note = noteIndex === null ? null : editor.snapshot.notes[noteIndex];
    const originalSelection = [...editor.selection];
    const tool = editor.view.tool;
    let kind: Gesture["kind"];
    let indices = originalSelection;
    if (tool === "pan") kind = "pan";
    else if (!editor.editable) kind = note ? "tap" : "pan";
    else if (tool === "erase") kind = "erase";
    else if (note && noteIndex !== null) {
      if (event.shiftKey) {
        editor.select([noteIndex], "toggle");
        indices = originalSelection.includes(noteIndex)
          ? originalSelection.filter((index) => index !== noteIndex) : [...originalSelection, noteIndex];
      } else if (!selected.has(noteIndex)) {
        indices = [noteIndex];
        editor.select(indices);
      }
      const bounds = logicalBounds(noteElement!);
      const axes = pointerAxes(noteElement!, event);
      kind = event.shiftKey && !indices.includes(noteIndex) ? "tap"
        : bounds.left + bounds.width - axes.x <= Math.min(10, bounds.width / 3) ? "resize" : "move";
    } else if (tool === "select") kind = "marquee";
    else kind = "draw";
    event.preventDefault();
    if (noteElement) noteElement.focus({ preventScroll: true });
    const active: Gesture = {
      kind, pointerId: event.pointerId, axes: pointerAxes(event.currentTarget, event),
      origin: point, previous: point, moved: false, indices, selected: originalSelection,
      notes: editor.snapshot.notes, erased: new Set(), pitch: rows[row], noteIndex,
      additive: event.shiftKey, scrollLeft: event.currentTarget.scrollLeft, scrollTop: event.currentTarget.scrollTop,
    };
    gesture.current = active;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (["draw", "move", "resize", "erase"].includes(kind)) editor.beginGesture();
    if (kind === "draw" || kind === "erase") preview(active, point);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const axes = pointerAxes(event.currentTarget, event);
    if (!active.moved && Math.hypot(axes.x - active.axes.x, axes.y - active.axes.y) < 5) return;
    active.moved = true;
    if (active.kind === "pan") {
      event.currentTarget.scrollLeft = active.scrollLeft - (axes.x - active.axes.x);
      event.currentTarget.scrollTop = active.scrollTop - (axes.y - active.axes.y);
    } else if (active.kind !== "tap") preview(active, contentPoint(event));
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const axes = pointerAxes(event.currentTarget, event);
    active.moved ||= Math.hypot(axes.x - active.axes.x, axes.y - active.axes.y) >= 5;
    if (["draw", "erase"].includes(active.kind) || (active.moved && ["move", "resize", "marquee"].includes(active.kind))) {
      preview(active, active.moved ? contentPoint(event) : active.origin);
    }
    gesture.current = null;
    releaseCapture(active.pointerId);
    setMarquee(null);
    if (["draw", "erase"].includes(active.kind) || (active.moved && ["move", "resize"].includes(active.kind))) {
      editor.commitGesture();
    } else {
      editor.cancelGesture();
      if (active.kind === "marquee" && !active.moved && !active.additive) editor.clearSelection();
    }
    if (!active.moved && active.noteIndex !== null && active.kind !== "erase" && active.kind !== "pan") {
      const note = active.notes[active.noteIndex];
      if (note) {
        if (!editor.editable) editor.select([active.noteIndex], active.additive ? "toggle" : "replace");
        onAudition(note.pitch);
      }
    }
  }
  function seek(event: { clientX: number; clientY: number }, element: HTMLElement) {
    if (pixelsPerTick <= 0) return;
    onSeekTick(clamp((pointerAxes(element, event).x - logicalBounds(element).left) / pixelsPerTick, 0, maxTick));
  }
  const beatPixels = ppq * 4 / signature.denominator * pixelsPerTick;
  const barPixels = beatPixels * signature.numerator;
  const snapPixels = stepTick * pixelsPerTick;
  const gridBackground = pixelsPerTick > 0
    ? `repeating-linear-gradient(to right,var(--grid-bar) 0 1.5px,transparent 1.5px ${barPixels}px),repeating-linear-gradient(to right,var(--grid-beat) 0 1px,transparent 1px ${beatPixels}px),repeating-linear-gradient(to right,var(--grid-cell) 0 1px,transparent 1px ${snapPixels}px)`
    : "none";

  return (
    <div
      className={cn(studioStyles.noteWorkspace, studioStyles.teamNoteWorkspace)}
      ref={workspaceRef}
      aria-label={drum ? `드럼 피아노롤${hiddenCount ? `, 숨은 노트 ${hiddenCount}개` : ""}` : "피아노롤"}
      style={{ gridTemplateColumns: `${keyWidth}px max-content`, gridTemplateRows: `${rulerHeight}px max-content`, touchAction: "none" }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cancel}
      onLostPointerCapture={(event) => {
        if (gesture.current?.pointerId === event.pointerId) cancel();
      }}
      onScroll={(event) => {
        if (pixelsPerTick > 0) {
          const next = event.currentTarget.scrollLeft / pixelsPerTick;
          if (Math.abs(next - editor.view.viewStartTick) * pixelsPerTick > 0.5) editor.setViewStartTick(next);
        }
      }}
    >
      <div className={studioStyles.noteRulerCorner} style={{ gridColumn: 1, gridRow: 1 }} aria-hidden="true" />
      <div
        className={studioStyles.noteRuler}
        style={{ width, gridColumn: 2, gridRow: 1 }}
        aria-label="피아노롤 눈금자"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest(".ruler-handle")) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          seek(event, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event, event.currentTarget);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <MusicalRuler signature={signature} width={width} tickWindow={{
          ppq, startTick, endTick: Math.min(maxTick, startTick + windowTicks), pixelsPerTick,
        }} />
        <button
          type="button"
          className={cn(studioStyles.notePlayheadHandle, "ruler-handle")}
          style={{ left: playheadTick * pixelsPerTick - 10 }}
          role="slider"
          aria-label="재생 위치 이동"
          aria-valuemin={0}
          aria-valuemax={maxTick}
          aria-valuenow={Math.round(playheadTick)}
          aria-valuetext={`${Math.round(playheadTick)} 틱`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event, event.currentTarget.parentElement!);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              seek(event, event.currentTarget.parentElement!);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            onSeekTick(event.key === "Home" ? 0 : event.key === "End" ? maxTick
              : clamp(playheadTick + (event.key === "ArrowRight" ? stepTick : -stepTick), 0, maxTick));
          }}
        />
      </div>
      <div
        className={studioStyles.pianoKeys}
        style={{ height, gridTemplateRows: `repeat(${rows.length}, ${rowHeight}px)`, gridColumn: 1, gridRow: 2, left: 0 }}
      >
        {rows.map((pitch) => (
          <button
            type="button"
            className={cn(studioStyles.pianoKey, drum ? "drum-key" : pitchNames[pitch % 12].includes("#") ? sharedStyles.black : "")}
            key={pitch}
            aria-label={`${pitchLabel(pitch)} 미리듣기`}
            title={pitchLabel(pitch)}
            onClick={() => onAudition(pitch)}
          >
            {drum && <DrumPadIcon kind={drumPadFor(pitch)?.icon ?? "percussion"} />}
            <span style={{ display: "inline", position: "static", transform: "none" }}>{pitchLabel(pitch)}</span>
          </button>
        ))}
      </div>
      <div
        className={studioStyles.pianoRoll}
        ref={rollRef}
        style={{ width, height, gridColumn: 2, gridRow: 2, touchAction: "none" }}
      >
        {rows.map((pitch, row) => (
          <div
            className={cn(studioStyles.pianoRow, !drum && pitchNames[pitch % 12].includes("#") ? sharedStyles.sharpRow : "natural-row")}
            style={{ width, height: rowHeight }}
            data-row={row}
            key={pitch}
          >
            <button
              type="button"
              className={studioStyles.teamNoteCell}
              style={{ backgroundImage: gridBackground }}
              aria-label={`${pitchLabel(pitch)} 노트 추가`}
              aria-disabled={!editor.editable}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !editor.editable || pixelsPerTick <= 0) return;
                event.preventDefault();
                const noteStart = Math.floor(playheadTick / stepTick) * stepTick;
                const durationTick = Math.min(stepTick, maxTick - noteStart);
                if (durationTick > 0) editor.execute({ type: "insert", notes: [{
                  pitch, startTick: noteStart, durationTick, velocity: 100, effectType: null, effectParams: {},
                }] });
              }}
            />
          </div>
        ))}
        {editor.displayNotes.map((note, index) => {
          const row = rowIndices.get(note.pitch);
          if (row === undefined) return null;
          return (
            <button
              type="button"
              key={index}
              data-note-index={index}
              className={studioStyles.pianoNote}
              style={{ left: note.startTick * pixelsPerTick, top: row * rowHeight + 3,
                width: Math.max(1, note.durationTick * pixelsPerTick - 1), height: rowHeight - 6, touchAction: "none" }}
              aria-label={`${pitchLabel(note.pitch)} 노트, 시작 ${note.startTick} 틱, 길이 ${note.durationTick} 틱`}
              aria-pressed={selected.has(index)}
              title="탭으로 선택과 미리듣기 · 드래그로 이동 · 오른쪽 끝으로 길이 조절 · Enter로 노트 설정"
              onClick={(event) => {
                if (event.detail !== 0) return;
                editor.select([index], event.shiftKey ? "toggle" : "replace");
                onAudition(note.pitch);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  editor.select([index]);
                  if (editor.editable) onSettings?.(index);
                  else onAudition(note.pitch);
                  return;
                }
                const indices = selected.has(index) ? [...editor.selection] : [index];
                if (!editor.editable) return;
                if (event.key === "Delete" || event.key === "Backspace") {
                  event.preventDefault();
                  editor.execute({ type: "delete", indices });
                } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                  event.preventDefault();
                  editor.select(indices);
                  const direction = event.key === "ArrowRight" ? 1 : -1;
                  editor.execute(event.shiftKey && ["ArrowLeft", "ArrowRight"].includes(event.key)
                    ? { type: "resize", indices, deltaTick: direction * stepTick }
                    : { type: "move", indices,
                      deltaTick: event.key === "ArrowLeft" ? -stepTick : event.key === "ArrowRight" ? stepTick : 0,
                      deltaRow: event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0 });
                }
              }}
            >
              {drum ? <DrumPadIcon kind={drumPadFor(note.pitch)?.icon ?? "percussion"} /> : pitchNames[note.pitch % 12]}
            </button>
          );
        })}
        {marquee && <div className="piano-marquee" aria-hidden="true" style={{ position: "absolute", pointerEvents: "none", ...marquee }} />}
        <div
          className={studioStyles.notePlayhead}
          style={{ left: playheadTick * pixelsPerTick, top: 0, height, minHeight: height, bottom: "auto", animation: "none" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

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
import { MIN_ROLL_ZOOM, MAX_ROLL_ZOOM, rollTouchPair, zoomRollViewport, type RollViewport } from "./note-roll-zoom";

const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
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
  /** A tap (no drag) on an already selected note in additive mode removes it on release. */
  toggleOff: boolean;
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
  instrument, initialPitch, onAudition, onSettings, rowHeight: baseRowHeight = 30, keyWidth: baseKeyWidth = 87, clipStartTick = 0, suggestion, revealSuggestion,
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
  clipStartTick?: number;
  revealSuggestion?: { pitch: number } | null;
  suggestion?: { name: string; notes: MidiNoteDto[]; apply: () => void };
  /** Pitch row height and key column width in canvas px; the portrait layout enlarges the touch targets. */
  rowHeight?: number;
  keyWidth?: number;
}) {
  const zoom = editor.view.zoom;
  const rowHeight = baseRowHeight * zoom;
  const keyWidth = baseKeyWidth * zoom;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const latestEditor = useRef(editor);
  useLayoutEffect(() => {
    latestEditor.current = editor;
  });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ view: RollViewport; centre: Point; distance: number } | null>(null);
  const zoomSession = useRef(false);
  const suppressClickUntil = useRef(0);
  const zoomView = useRef<RollViewport | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const rows = editor.bounds.rows;
  const rowIndices = useMemo(() => new Map(rows.map((pitch, row) => [pitch, row])), [rows]);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const pitch = revealSuggestion?.pitch;
    const row = pitch === undefined ? undefined : rowIndices.get(Math.ceil(pitch));
    if (workspace && row != null && pitch !== undefined) {
      workspace.scrollTop = (row + Math.ceil(pitch) - pitch) * rowHeight
        - (workspace.clientHeight - rulerHeight - rowHeight) / 2;
    }
  }, [revealSuggestion, rowHeight, rowIndices]);
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

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (pendingScroll.current !== null) {
      workspace.scrollTop = pendingScroll.current;
      pendingScroll.current = null;
    }
    zoomView.current = { width: workspace.clientWidth, height: workspace.clientHeight - rulerHeight,
      baseKeyWidth, baseRowHeight, baseWindowTicks: windowTicks * zoom, maxTick, rows: rows.length,
      zoom, viewStartTick: startTick, scrollTop: workspace.scrollTop };
  });

  function changeZoom(value: number, from?: Point, to = from, initial = zoomView.current) {
    if (!initial) return;
    const point = from ?? { x: (initial.width + initial.baseKeyWidth * initial.zoom) / 2, y: initial.height / 2 };
    const view = { ...initial, scrollTop: initial === zoomView.current
      ? workspaceRef.current?.scrollTop ?? initial.scrollTop : initial.scrollTop };
    const next = zoomRollViewport(view, value, point, to ?? point);
    pendingScroll.current = next.scrollTop;
    zoomView.current = { ...view, ...next };
    editor.setZoom(next.zoom, next.viewStartTick);
    // Panning at the zoom limits may not change the editor state, but still moves the pitch viewport.
    if (next.zoom === zoom && workspaceRef.current) workspaceRef.current.scrollTop = next.scrollTop;
  }
  function touchPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pointerAxes(event.currentTarget, event);
    const bounds = logicalBounds(event.currentTarget);
    return { x: point.x - bounds.left, y: point.y - bounds.top - rulerHeight };
  }
  function restartPinch() {
    const view = zoomView.current;
    if (!view) return;
    const points = [...touches.current.values()];
    const pair = points.length > 1 ? rollTouchPair(points) : { centre: points[0], distance: 0 };
    pinch.current = points.length ? { ...pair, view: { ...view,
      scrollTop: workspaceRef.current?.scrollTop ?? view.scrollTop } } : null;
  }
  function touchDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || touchPoint(event).y < 0 || touches.current.size >= 2) return;
    touches.current.set(event.pointerId, touchPoint(event));
    if (touches.current.size < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const active = gesture.current;
    cancel();
    if (active && active.notes === latestEditor.current.snapshot.notes) editor.select(active.selected);
    zoomSession.current = true;
    for (const id of touches.current.keys()) event.currentTarget.setPointerCapture(id);
    restartPinch();
  }
  function touchMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!touches.current.has(event.pointerId)) return;
    touches.current.set(event.pointerId, touchPoint(event));
    const active = pinch.current;
    if (!zoomSession.current || !active) return;
    event.preventDefault();
    event.stopPropagation();
    const points = [...touches.current.values()];
    const pair = points.length > 1 ? rollTouchPair(points) : { centre: points[0], distance: 0 };
    changeZoom(active.view.zoom * (active.distance ? pair.distance / active.distance : 1),
      active.centre, pair.centre, active.view);
  }
  function touchEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!touches.current.delete(event.pointerId) || !zoomSession.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntil.current = Date.now() + 500;
    restartPinch();
    if (!touches.current.size) zoomSession.current = false;
  }
  const wheelZoom = useEffectEvent((event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    cancel();
    const workspace = workspaceRef.current!;
    const point = pointerAxes(workspace, event);
    const bounds = logicalBounds(workspace);
    changeZoom(zoom * Math.exp(-event.deltaY / 500), {
      x: point.x - bounds.left, y: point.y - bounds.top - rulerHeight,
    });
  });
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const listener = (event: WheelEvent) => wheelZoom(event);
    workspace.addEventListener("wheel", listener, { passive: false });
    return () => workspace.removeEventListener("wheel", listener);
  }, []);

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
  }, [keyWidth]);

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
      // The select tool is additive without a modifier so touch screens can build a multi-selection.
      const additive = event.shiftKey || tool === "select";
      if (additive) {
        if (!originalSelection.includes(noteIndex)) {
          indices = [...originalSelection, noteIndex];
          editor.select([noteIndex], "add");
        }
      } else if (!selected.has(noteIndex)) {
        indices = [noteIndex];
        editor.select(indices);
      }
      const bounds = logicalBounds(noteElement!);
      const axes = pointerAxes(noteElement!, event);
      kind = bounds.left + bounds.width - axes.x <= Math.min(10, bounds.width / 3) ? "resize" : "move";
    } else if (tool === "select") kind = "marquee";
    else kind = "draw";
    event.preventDefault();
    if (noteElement) noteElement.focus({ preventScroll: true });
    const active: Gesture = {
      kind, pointerId: event.pointerId, axes: pointerAxes(event.currentTarget, event),
      origin: point, previous: point, moved: false, indices, selected: originalSelection,
      notes: editor.snapshot.notes, erased: new Set(), pitch: rows[row], noteIndex,
      additive: event.shiftKey, scrollLeft: event.currentTarget.scrollLeft, scrollTop: event.currentTarget.scrollTop,
      toggleOff: (event.shiftKey || tool === "select") && noteIndex !== null && originalSelection.includes(noteIndex),
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
        else if (active.toggleOff) editor.select([active.noteIndex], "toggle");
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
  const gridPosition = `${-clipStartTick * pixelsPerTick}px 0, ${-clipStartTick * pixelsPerTick}px 0, 0 0`;
  const gridBackground = pixelsPerTick > 0
    ? `repeating-linear-gradient(to right,var(--grid-bar) 0 1.5px,transparent 1.5px ${barPixels}px),repeating-linear-gradient(to right,var(--grid-beat) 0 1px,transparent 1px ${beatPixels}px),repeating-linear-gradient(to right,var(--grid-cell) 0 1px,transparent 1px ${snapPixels}px)`
    : "none";

  return (
    <div className="note-roll-view flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className="flex h-8 shrink-0 items-center justify-between gap-1.5 border-b border-[#2b2b34] bg-app-panel px-2.5 text-caption text-app-muted"
        role="group"
        aria-label="피아노롤 확대·축소"
      >
        <span className="text-caption font-medium text-app-muted">피아노롤</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="피아노롤 축소"
            className="grid h-6 w-7 place-items-center rounded-[7px] border border-[#32323d] bg-[#23232a] text-label text-app-fg disabled:opacity-35"
            disabled={zoom <= MIN_ROLL_ZOOM}
            onClick={() => { cancel(); changeZoom(zoom / 1.25); }}
          >
            −
          </button>
          <output className="w-11 text-center font-medium tabular-nums text-app-fg" aria-label="피아노롤 배율">
            {Math.round(zoom * 100)}%
          </output>
          <button
            type="button"
            aria-label="피아노롤 확대"
            className="grid h-6 w-7 place-items-center rounded-[7px] border border-[#32323d] bg-[#23232a] text-label text-app-fg disabled:opacity-35"
            disabled={zoom >= MAX_ROLL_ZOOM}
            onClick={() => { cancel(); changeZoom(zoom * 1.25); }}
          >
            +
          </button>
        </div>
      </div>
    <div
      className={cn(studioStyles.noteWorkspace, studioStyles.teamNoteWorkspace)}
      ref={workspaceRef}
      aria-label={drum ? `드럼 피아노롤${hiddenCount ? `, 숨은 노트 ${hiddenCount}개` : ""}` : "피아노롤"}
      style={{ gridTemplateColumns: `${keyWidth}px max-content`, gridTemplateRows: `${rulerHeight}px max-content`, touchAction: "none" }}
      onPointerDownCapture={touchDown}
      onPointerMoveCapture={touchMove}
      onPointerUpCapture={touchEnd}
      onPointerCancelCapture={touchEnd}
      onClickCapture={(event) => {
        if (event.detail > 0 && (zoomSession.current || Date.now() < suppressClickUntil.current)) {
          event.preventDefault(); event.stopPropagation();
        }
      }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cancel}
      onLostPointerCapture={(event) => {
        const active = gesture.current;
        if (active?.pointerId !== event.pointerId) return;
        // Chrome can drop capture just before the matching pointerup (e.g. a press shortly after a tap), so losing
        // capture is not a cancellation. Re-capture while the pointer is live; pointerup/pointercancel end the gesture.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is gone. A pointerup bubbling from inside the roll in the same input still finishes it.
          window.setTimeout(() => {
            if (gesture.current === active) cancel();
          }, 0);
        }
      }}
      onScroll={(event) => {
        if (pixelsPerTick > 0) {
          const next = event.currentTarget.scrollLeft / pixelsPerTick;
          if (Math.abs(next - editor.view.viewStartTick) * pixelsPerTick > 0.5) editor.setViewStartTick(next);
        }
      }}
    >
      <div
        className={cn(studioStyles.noteRulerCorner, "border-b-2 border-solid border-app-border shadow-[0_-1px_0_var(--panel)]")}
        style={{ gridColumn: 1, gridRow: 1 }}
        aria-hidden="true"
      />
      <div
        className={cn(studioStyles.noteRuler, "block! min-w-full")}
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
          ppq, startTick, endTick: Math.min(maxTick, startTick + windowTicks), pixelsPerTick, originTick: clipStartTick,
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
        style={{ height, width: keyWidth, gridTemplateRows: `repeat(${rows.length}, ${rowHeight}px)`, gridColumn: 1, gridRow: 2, left: 0 }}
      >
        {rows.map((pitch) => (
          <button
            type="button"
            className={cn(studioStyles.pianoKey, drum ? "drum-key" : pitchNames[pitch % 12].includes("#") ? sharedStyles.black : "")}
            key={pitch}
            aria-label={`${pitchLabel(pitch)} 미리듣기`}
            title={pitchLabel(pitch)}
            onClick={() => onAudition(pitch)}
            style={{ height: rowHeight, minHeight: rowHeight, width: keyWidth }}
          >
            {drum ? (
              <DrumPadIcon kind={drumPadFor(pitch)?.icon ?? "percussion"} />
            ) : (
              <span style={{ display: "inline", position: "static", transform: "none", fontSize: 12 * zoom }}>{pitchLabel(pitch)}</span>
            )}
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
            style={{ width, height: rowHeight, minHeight: rowHeight }}
            data-row={row}
            key={pitch}
          >
            <button
              type="button"
              className={studioStyles.teamNoteCell}
              style={{ backgroundImage: gridBackground, backgroundPosition: gridPosition }}
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
        {suggestion?.notes.map((note) => {
          const row = rowIndices.get(note.pitch);
          if (row === undefined) return null;
          return (
            <button type="button" key={note.pitch} data-chord-preview
              className="absolute z-[1] rounded border border-dashed border-violet-200 bg-violet-500/35 px-1 text-left text-caption text-violet-100 hover:bg-violet-500/55"
              style={{ left: note.startTick * pixelsPerTick, top: row * rowHeight + 3,
                width: Math.max(1, note.durationTick * pixelsPerTick - 1), height: rowHeight - 6 }}
              aria-label={`${suggestion.name} 추천 코드 넣기, ${pitchLabel(note.pitch)}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={suggestion.apply}>
              {pitchNames[note.pitch % 12]}
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
    </div>
  );
}

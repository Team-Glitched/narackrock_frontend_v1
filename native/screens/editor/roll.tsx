/**
 * The app's piano roll (the web's TeamPianoRoll, NoteEditorControls, NoteTools, ChordPickerDialog and
 * NoteSettingsDialog) over a `NativeNoteRoll` model. Gestures run here and preview with the web's own edit
 * rules (note-editing.ts); on release one `roll-edit` goes to the page, which validates and commits it
 * through its note editor (history, draft). Reused by the creation pages' sample piano.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Line } from "react-native-svg";

import {
  chordFits,
  chordLengths,
  chordQualities,
  chordRoots,
  type ChordLength,
} from "../../../src/features/composition/chord-input";
import { drumPadFor } from "../../../src/features/composition/drum-kit";
import { applyNoteEdit } from "../../../src/features/composition/note-editing";
import { MIN_ROLL_ZOOM, MAX_ROLL_ZOOM, rollTouchPair, zoomRollViewport, type RollViewport } from "../../../src/features/composition/note-roll-zoom";
import {
  noteLengthLimits,
  notePercent,
  withNoteLength,
  withNotePercent,
} from "../../../src/features/composition/note-settings";
import type { MidiNoteDto } from "../../../src/lib/api/composition";
import type {
  NativeNoteEdit,
  NativeNoteRoll,
  NativeNoteSettings,
  NativeNoteTool,
} from "../../../src/lib/native-screens";
import { useNativeAudioState } from "../../audio";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { Dialog, DialogButton, NumberField, Slider } from "../studio/parts";
import { DrumPadIcon } from "./drum-pad-icon";
import { Icon, type IconName } from "./icons";

const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const rulerHeight = 30;
/** Movement (px) before a press becomes a drag, as on the web. */
const dragSlop = 5;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const sharp = (pitch: number) => pitchNames[pitch % 12].includes("#");

function pitchLabel(roll: NativeNoteRoll, pitch: number) {
  return roll.drum
    ? (drumPadFor(pitch)?.label ?? `타악기 ${pitch}`)
    : `${pitchNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

type Point = { x: number; y: number };

// Segment/rectangle intersection keeps fast eraser sweeps from skipping narrow notes (the web's rule).
function crossesNote(from: Point, to: Point, left: number, top: number, right: number, bottom: number) {
  let enter = 0;
  let leave = 1;
  for (const [start, delta, low, high] of [
    [from.x, to.x - from.x, left, right],
    [from.y, to.y - from.y, top, bottom],
  ] as const) {
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

type Gesture = {
  kind: "draw" | "move" | "resize" | "erase" | "marquee" | "pan" | "tap" | "suggestion";
  origin: Point;
  previous: Point;
  moved: boolean;
  /** Notes and revision when the gesture began; the edit applies to them. */
  notes: MidiNoteDto[];
  revision: number;
  indices: number[];
  selection: number[];
  erased: Set<number>;
  hits: number[];
  pitch: number;
  noteIndex: number | null;
  toggleOff: boolean;
  scroll: Point;
  edit: NativeNoteEdit | null;
};

/** What the roll shows instead of the model: a gesture in progress, or a sent edit until the page answers. */
type Preview = {
  notes: MidiNoteDto[];
  selection: number[];
  /** Sent; dropped when the model's revision, selection or error changes (or after a moment). */
  sent: { revision: number; selection: string; error: string | null } | null;
};

type Layout = {
  roll: NativeNoteRoll;
  rowHeight: number;
  ppt: number;
  width: number;
  height: number;
  scroll: Point;
  maxScroll: Point;
  rowIndex: Map<number, number>;
};

const landscapeKeyWidth = 87;

/**
 * Pitch grid with the keyboard (or drum pads), ruler and playhead. Fills its parent. Taps on keys and
 * notes audition through the page; the ruler seeks; the edit tool decides what a drag on the grid does.
 */
export function NoteRoll({
  roll: model,
  rowHeight: baseRowHeight = 30,
  keyWidth: baseKeyWidth = landscapeKeyWidth,
}: {
  roll: NativeNoteRoll;
  /** Pitch row height and key column width; the portrait layout enlarges the touch targets. */
  rowHeight?: number;
  keyWidth?: number;
}) {
  const { act } = useScreen();
  const [zoomPreview, setZoomPreview] = useState<{ zoom: number; tick: number; pending: boolean } | null>(null);
  const roll = zoomPreview ? { ...model, zoom: zoomPreview.zoom, viewStartTick: zoomPreview.tick,
    windowTicks: model.windowTicks * model.zoom / zoomPreview.zoom } : model;
  const rowHeight = baseRowHeight * roll.zoom;
  const keyWidth = baseKeyWidth * roll.zoom;
  useEffect(() => {
    if (zoomPreview?.pending && model.zoom === zoomPreview.zoom && Math.abs(model.viewStartTick - zoomPreview.tick) < 0.01)
      setZoomPreview(null);
  }, [model.zoom, model.viewStartTick, zoomPreview]);
  // Like the web's upright layout: a narrower key column leaves no room beside a black key for its name.
  const blackKeyLabels = keyWidth >= landscapeKeyWidth;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [panX, setPanX] = useState<number | null>(null);
  const [centered, setCentered] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [dragTick, setDragTick] = useState<number | null>(null);

  const viewportWidth = Math.max(0, size.width - keyWidth);
  const viewportHeight = Math.max(0, size.height - rulerHeight);
  const ppt = roll.windowTicks > 0 ? viewportWidth / roll.windowTicks : 0;
  const width = roll.maxTick * ppt;
  const height = roll.rows.length * rowHeight;
  const maxScroll = {
    x: Math.max(0, roll.maxTick - roll.windowTicks) * ppt,
    y: Math.max(0, height - viewportHeight),
  };
  const scroll = {
    x: clamp(panX ?? roll.viewStartTick * ppt, 0, maxScroll.x),
    y: clamp(scrollY, 0, maxScroll.y),
  };
  const rowIndex = useMemo(() => new Map(roll.rows.map((pitch, row) => [pitch, row])), [roll.rows]);

  // Center the requested pitch when the roll opens and whenever the shown row set changes (the web's rule).
  const centerKey = `${roll.rows.join(",")}|${roll.initialPitch}|${roll.drum}`;
  if (size.height > 0 && centered !== centerKey) {
    setCentered(centerKey);
    const pitch = roll.rows.includes(roll.initialPitch) ? roll.initialPitch : roll.drum ? 36 : roll.initialPitch;
    const row = Math.max(0, roll.rows.indexOf(pitch));
    setScrollY(Math.max(0, row * rowHeight - (viewportHeight - rowHeight) / 2));
  }

  const revealPitch = roll.suggestion?.reveal?.pitch;
  const revealSequence = roll.suggestion?.reveal?.sequence;
  const revealRows = roll.rows.join(",");
  const scrollToReveal = useEffectEvent(() => {
    if (revealPitch === undefined) return;
    const row = roll.rows.indexOf(Math.ceil(revealPitch));
    if (row >= 0) setScrollY(Math.max(0,
      (row + Math.ceil(revealPitch) - revealPitch) * rowHeight - (viewportHeight - rowHeight) / 2));
  });
  // Only a new reveal request recentres the pitch; zoom/model acknowledgements must keep the pinch anchor.
  useEffect(() => scrollToReveal(), [revealSequence, revealPitch, revealRows]);

  // A pan keeps its local offset until the page moved the window (or clamped it to the same place).
  const viewStart = roll.viewStartTick;
  useEffect(() => setPanX(null), [viewStart]);

  // A sent edit stays drawn until the page answers, so the notes never jump back for a frame.
  const answer = `${roll.revision}|${roll.selection.join(",")}|${roll.error}`;
  useEffect(() => {
    setPreview((current) =>
      current?.sent &&
      `${current.sent.revision}|${current.sent.selection}|${current.sent.error}` !== answer
        ? null
        : current,
    );
  }, [answer]);
  const sentAt = preview?.sent ? preview : null;
  useEffect(() => {
    if (!sentAt) return;
    const timer = setTimeout(() => setPreview((current) => (current === sentAt ? null : current)), 800);
    return () => clearTimeout(timer);
  }, [sentAt]);

  // Tool, snap, window, rows or size changes drop a gesture in progress (its coordinates are stale).
  const gesture = useRef<Gesture | null>(null);
  const config = [roll.editable, roll.tool, roll.stepTick, roll.windowTicks, roll.rows.join(","), size.width, size.height].join("|");
  useEffect(() => {
    if (!gesture.current) return;
    gesture.current = null;
    setPreview(null);
    setMarquee(null);
  }, [config]);

  const layout = useRef<Layout>(null as unknown as Layout);
  layout.current = { roll, rowHeight, ppt, width, height, scroll, maxScroll, rowIndex };
  const actRef = useRef(act);
  actRef.current = act;
  const root = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const zoomLayout = useRef<RollViewport>(null as unknown as RollViewport);
  zoomLayout.current = { width: size.width, height: viewportHeight, baseKeyWidth, baseRowHeight,
    baseWindowTicks: roll.windowTicks * roll.zoom, maxTick: roll.maxTick, rows: roll.rows.length,
    zoom: roll.zoom, viewStartTick: ppt > 0 ? scroll.x / ppt : roll.viewStartTick, scrollTop: scroll.y };
  const zoomGesture = useRef<{ view: RollViewport; centre: Point; distance: number } | null>(null);
  const priorSelection = useRef<number[] | null>(null);
  const zoomResult = useRef<{ zoom: number; viewStartTick: number } | null>(null);
  const zoomCallbacks = useRef({
    apply(value: number, from?: Point, to = from, view = zoomLayout.current) {
      const centre = from ?? { x: (view.width + view.baseKeyWidth * view.zoom) / 2, y: view.height / 2 };
      const next = zoomRollViewport(view, value, centre, to ?? centre);
      zoomResult.current = next;
      zoomLayout.current = { ...view, ...next };
      setZoomPreview({ zoom: next.zoom, tick: next.viewStartTick, pending: false });
      setPanX(null);
      setScrollY(next.scrollTop);
    },
    finish() {
      const next = zoomResult.current;
      zoomGesture.current = null;
      if (!next) return;
      zoomResult.current = null;
      setZoomPreview({ zoom: next.zoom, tick: next.viewStartTick, pending: true });
      actRef.current({ type: "roll-zoom", zoom: next.zoom, tick: next.viewStartTick });
    },
  });
  const zoomResponder = useMemo(() => {
    const points = (event: GestureResponderEvent) => event.nativeEvent.touches.map(touch => ({
      x: touch.pageX - origin.current.x, y: touch.pageY - origin.current.y - rulerHeight,
    }));
    const capture = (event: GestureResponderEvent) => {
      const fingers = points(event);
      if (fingers.length < 2 || fingers.some(point => point.y < 0)) return false;
      if (zoomGesture.current) return true;
      priorSelection.current ??= gesture.current?.selection ?? layout.current.roll.selection;
      zoomGesture.current = { view: { ...zoomLayout.current }, ...rollTouchPair(fingers) };
      return true;
    };
    const start = (event: GestureResponderEvent) => {
      const fingers = points(event);
      if (!fingers.length) return;
      zoomGesture.current = { view: { ...zoomLayout.current },
        ...(fingers.length >= 2 ? rollTouchPair(fingers) : { centre: fingers[0], distance: 0 }) };
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: capture,
      onMoveShouldSetPanResponderCapture: capture,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: event => {
        gesture.current = null;
        setPreview(null); setMarquee(null);
        if (priorSelection.current) actRef.current({ type: "roll-select", indices: priorSelection.current });
        priorSelection.current = null;
        if (!zoomGesture.current) start(event);
      },
      onPanResponderStart: start,
      onPanResponderEnd: event => { if (points(event).length) start(event); },
      onPanResponderMove: event => {
        const fingers = points(event), active = zoomGesture.current;
        if (!active || !fingers.length) return;
        const pair = fingers.length >= 2 ? rollTouchPair(fingers) : { centre: fingers[0], distance: 0 };
        if (Boolean(pair.distance) !== Boolean(active.distance)) { start(event); return; }
        zoomCallbacks.current.apply(active.view.zoom * (active.distance ? pair.distance / active.distance : 1),
          active.centre, pair.centre, active.view);
      },
      onPanResponderRelease: () => zoomCallbacks.current.finish(),
      onPanResponderTerminate: () => zoomCallbacks.current.finish(),
    });
  }, []);

  const grid = useMemo(() => {
    function noteAt(notes: MidiNoteDto[], point: Point): number | null {
      const { ppt: scale, rowHeight: rh, rowIndex: rows } = layout.current;
      for (let index = notes.length - 1; index >= 0; index--) {
        const note = notes[index];
        const row = rows.get(note.pitch);
        if (
          row !== undefined &&
          point.y >= row * rh &&
          point.y < (row + 1) * rh &&
          point.x >= note.startTick * scale &&
          point.x <= (note.startTick + note.durationTick) * scale
        )
          return index;
      }
      return null;
    }
    function show(active: Gesture, point: Point) {
      const { roll: model, ppt: scale, rowHeight: rh, rowIndex: rows } = layout.current;
      const step = model.stepTick;
      const bounds = {
        maxTick: model.maxTick,
        minPitch: model.minPitch,
        maxPitch: model.maxPitch,
        stepTick: step,
        rows: model.rows,
      };
      if (active.kind === "draw") {
        const originTick = Math.floor(active.origin.x / scale / step) * step;
        const currentTick = Math.floor(point.x / scale / step) * step;
        const startTick = Math.max(0, Math.min(originTick, currentTick));
        const endTick = Math.min(model.maxTick, Math.max(originTick, currentTick) + step);
        const note: MidiNoteDto = {
          pitch: active.pitch,
          startTick,
          durationTick: endTick - startTick,
          velocity: 100,
          effectType: null,
          effectParams: {},
        };
        active.edit = { type: "insert", notes: [note] };
        setPreview({ notes: [...active.notes, note], selection: [active.notes.length], sent: null });
      } else if (active.kind === "move" || active.kind === "resize") {
        const deltaTick = Math.round((point.x - active.origin.x) / scale / step) * step;
        active.edit =
          active.kind === "resize"
            ? { type: "resize", indices: active.indices, deltaTick }
            : {
                type: "move",
                indices: active.indices,
                deltaTick,
                deltaRow: Math.round((point.y - active.origin.y) / rh),
              };
        const result = applyNoteEdit({ notes: active.notes, selected: active.indices }, active.edit, bounds);
        setPreview({ notes: result.snapshot.notes, selection: active.indices, sent: null });
      } else if (active.kind === "erase") {
        active.notes.forEach((note, index) => {
          const row = rows.get(note.pitch);
          if (
            row !== undefined &&
            crossesNote(
              active.previous,
              point,
              note.startTick * scale,
              row * rh,
              (note.startTick + note.durationTick) * scale,
              (row + 1) * rh,
            )
          )
            active.erased.add(index);
        });
        active.edit = { type: "delete", indices: [...active.erased] };
        setPreview({
          notes: active.notes.filter((_, index) => !active.erased.has(index)),
          selection: [],
          sent: null,
        });
      } else if (active.kind === "marquee") {
        const { width: w, height: h } = layout.current;
        const left = clamp(Math.min(active.origin.x, point.x), 0, w);
        const right = clamp(Math.max(active.origin.x, point.x), 0, w);
        const top = clamp(Math.min(active.origin.y, point.y), 0, h);
        const bottom = clamp(Math.max(active.origin.y, point.y), 0, h);
        setMarquee({ left, top, width: right - left, height: bottom - top });
        active.hits = active.notes.flatMap((note, index) => {
          const row = rows.get(note.pitch);
          return row !== undefined &&
            row * rh < bottom &&
            (row + 1) * rh > top &&
            note.startTick * scale < right &&
            (note.startTick + note.durationTick) * scale > left
            ? [index]
            : [];
        });
        setPreview({ notes: active.notes, selection: active.hits, sent: null });
      }
      active.previous = point;
    }
    function current(active: Gesture, state: PanResponderGestureState): Point {
      return { x: active.origin.x + state.dx, y: active.origin.y + state.dy };
    }
    function grant(event: GestureResponderEvent) {
      const { roll: model, ppt: scale, rowHeight: rh, scroll: offset, width: w } = layout.current;
      gesture.current = null;
      if (scale <= 0) return;
      const point = {
        x: event.nativeEvent.locationX + offset.x,
        y: event.nativeEvent.locationY + offset.y,
      };
      const row = Math.floor(point.y / rh);
      if (model.rows[row] === undefined || point.x < 0 || point.x >= w) return;
      const notes = model.notes;
      const noteIndex = noteAt(notes, point);
      const note = noteIndex === null ? null : notes[noteIndex];
      const selection = model.selection;
      let kind: Gesture["kind"];
      let indices = selection;
      if (model.editable && model.suggestion && noteAt(model.suggestion.notes, point) !== null)
        kind = "suggestion";
      else if (model.tool === "pan") kind = "pan";
      else if (!model.editable) kind = note ? "tap" : "pan";
      else if (model.tool === "erase") kind = "erase";
      else if (note && noteIndex !== null) {
        // The select tool adds to the selection without a modifier, as on the web's touch screens.
        if (model.tool === "select") {
          if (!selection.includes(noteIndex)) {
            indices = [...selection, noteIndex];
            actRef.current({ type: "roll-select", indices: [noteIndex], mode: "add" });
          }
        } else if (!selection.includes(noteIndex)) {
          indices = [noteIndex];
          actRef.current({ type: "roll-select", indices });
        }
        const left = note.startTick * scale;
        const right = (note.startTick + note.durationTick) * scale;
        // The right end resizes; a finger needs a little more room than the web's 10px.
        kind = right - point.x <= Math.min(16, (right - left) / 3) ? "resize" : "move";
      } else if (model.tool === "select") kind = "marquee";
      else kind = "draw";
      const active: Gesture = {
        kind,
        origin: point,
        previous: point,
        moved: false,
        notes,
        revision: model.revision,
        indices,
        selection: [...selection],
        erased: new Set(),
        hits: [],
        pitch: model.rows[row],
        noteIndex,
        toggleOff: model.tool === "select" && noteIndex !== null && selection.includes(noteIndex),
        scroll: offset,
        edit: null,
      };
      gesture.current = active;
      if (kind === "move" || kind === "resize")
        setPreview({ notes, selection: indices, sent: null });
      if (kind === "draw" || kind === "erase") show(active, point);
    }
    function move(_: GestureResponderEvent, state: PanResponderGestureState) {
      const active = gesture.current;
      if (!active) return;
      if (!active.moved && Math.hypot(state.dx, state.dy) < dragSlop) return;
      active.moved = true;
      if (active.kind === "pan") {
        const limit = layout.current.maxScroll;
        setPanX(clamp(active.scroll.x - state.dx, 0, limit.x));
        setScrollY(clamp(active.scroll.y - state.dy, 0, limit.y));
      } else if (active.kind !== "tap" && active.kind !== "suggestion") show(active, current(active, state));
    }
    function release(_: GestureResponderEvent, state: PanResponderGestureState) {
      const active = gesture.current;
      gesture.current = null;
      if (!active) return;
      const send = actRef.current;
      const { roll: model, ppt: scale } = layout.current;
      active.moved ||= Math.hypot(state.dx, state.dy) >= dragSlop;
      if (active.kind === "suggestion") {
        if (!active.moved && active.revision === model.revision) send({ type: "editor-chord-apply" });
        return;
      }
      const edits = active.kind === "draw" || active.kind === "erase" ||
        (active.moved && (active.kind === "move" || active.kind === "resize"));
      if (edits || (active.moved && active.kind === "marquee"))
        show(active, active.moved ? current(active, state) : active.origin);
      setMarquee(null);
      const sent = { revision: model.revision, selection: model.selection.join(","), error: model.error };
      if (edits && active.edit) {
        send({
          type: "roll-edit",
          revision: active.revision,
          edit: active.edit,
          audition: active.kind === "draw" ? active.pitch : undefined,
        });
        setPreview((shown) => shown && { ...shown, sent });
      } else if (active.kind === "marquee") {
        if (active.moved) {
          send({ type: "roll-select", indices: active.hits });
          setPreview((shown) => shown && { ...shown, sent });
        } else {
          send({ type: "roll-clear-selection" });
          setPreview(null);
        }
      } else if (active.kind === "pan") {
        if (active.moved && scale > 0) {
          const limit = layout.current.maxScroll;
          send({ type: "roll-view", tick: clamp(active.scroll.x - state.dx, 0, limit.x) / scale });
        }
        setPreview(null);
      } else {
        setPreview((shown) => (active.moved ? null : shown && { ...shown, sent }));
      }
      if (!active.moved && active.noteIndex !== null && active.kind !== "erase" && active.kind !== "pan") {
        const note = active.notes[active.noteIndex];
        if (note) {
          if (!model.editable) send({ type: "roll-select", indices: [active.noteIndex] });
          else if (active.toggleOff) send({ type: "roll-select", indices: [active.noteIndex], mode: "toggle" });
          send({ type: "roll-audition", pitch: note.pitch });
        }
      }
    }
    function terminate() {
      gesture.current = null;
      setPreview(null);
      setMarquee(null);
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: (_, state) => state.numberActiveTouches >= 2,
      onPanResponderGrant: grant,
      onPanResponderMove: move,
      onPanResponderRelease: release,
      onPanResponderTerminate: terminate,
    });
  }, []);

  // Keys: a tap auditions the row's pitch; a drag scrolls the rows.
  const keys = useMemo(() => {
    const start = { y: 0, location: 0, moved: false };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        start.y = layout.current.scroll.y;
        start.location = event.nativeEvent.locationY;
        start.moved = false;
      },
      onPanResponderMove: (_, state) => {
        if (!start.moved && Math.hypot(state.dx, state.dy) < dragSlop) return;
        start.moved = true;
        setScrollY(clamp(start.y - state.dy, 0, layout.current.maxScroll.y));
      },
      onPanResponderRelease: () => {
        if (start.moved) return;
        const { roll: model, rowHeight: rh } = layout.current;
        const pitch = model.rows[Math.floor((start.location + start.y) / rh)];
        if (pitch !== undefined) actRef.current({ type: "roll-audition", pitch });
      },
    });
  }, []);

  // Ruler: tap or drag to move the playhead (sent while dragging, at most every 80ms, and on release).
  const ruler = useMemo(() => {
    const start = { location: 0, sentAt: 0 };
    const tickAt = (x: number) => {
      const { roll: model, ppt: scale, scroll: offset } = layout.current;
      return scale > 0 ? clamp((x + offset.x) / scale, 0, model.maxTick) : 0;
    };
    const seek = (tick: number, force: boolean) => {
      setDragTick(tick);
      const now = Date.now();
      if (!force && now - start.sentAt < 80) return;
      start.sentAt = now;
      actRef.current({ type: "roll-seek", tick });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => layout.current.ppt > 0,
      onMoveShouldSetPanResponder: () => layout.current.ppt > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        start.location = event.nativeEvent.locationX;
        seek(tickAt(start.location), true);
      },
      onPanResponderMove: (_, state) =>
        seek(tickAt(start.location + state.dx), false),
      onPanResponderRelease: (_, state) => {
        seek(tickAt(start.location + state.dx), true);
        setDragTick(null);
      },
      onPanResponderTerminate: () => setDragTick(null),
    });
  }, []);

  const notes = preview?.notes ?? roll.notes;
  const selected = new Set(preview?.selection ?? roll.selection);
  const firstRow = Math.max(0, Math.floor(scroll.y / rowHeight));
  const lastRow = Math.min(roll.rows.length - 1, Math.ceil((scroll.y + viewportHeight) / rowHeight));
  const visibleRows = roll.rows.slice(firstRow, lastRow + 1);
  const startTick = ppt > 0 ? scroll.x / ppt : 0;
  const endTick = ppt > 0 ? (scroll.x + viewportWidth) / ppt : 0;
  const lines = gridLines(roll, startTick, endTick);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ height: 32, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, paddingHorizontal: 8, backgroundColor: colors.panel }}>
        <Touchable accessibilityRole="button" accessibilityLabel="피아노롤 축소" disabled={roll.zoom <= MIN_ROLL_ZOOM}
          onPress={() => { zoomCallbacks.current.apply(roll.zoom / 1.25); zoomCallbacks.current.finish(); }}>
          <Text style={{ color: colors.fg, width: 36, textAlign: "center", fontSize: 20 }}>−</Text>
        </Touchable>
        <Text accessibilityLabel="피아노롤 배율" style={{ color: colors.muted, width: 48, textAlign: "center" }}>{Math.round(roll.zoom * 100)}%</Text>
        <Touchable accessibilityRole="button" accessibilityLabel="피아노롤 확대" disabled={roll.zoom >= MAX_ROLL_ZOOM}
          onPress={() => { zoomCallbacks.current.apply(roll.zoom * 1.25); zoomCallbacks.current.finish(); }}>
          <Text style={{ color: colors.fg, width: 36, textAlign: "center", fontSize: 20 }}>+</Text>
        </Touchable>
      </View>
    <View
      ref={root}
      style={styles.roll}
      {...zoomResponder.panHandlers}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w !== size.width || h !== size.height) setSize({ width: w, height: h });
        root.current?.measureInWindow((x, y) => { origin.current = { x, y }; });
      }}
      accessibilityLabel={
        roll.drum ? `드럼 피아노롤${roll.hidden ? `, 숨은 노트 ${roll.hidden}개` : ""}` : "피아노롤"
      }
    >
      <View style={[styles.corner, { width: keyWidth }]} />
      <View
        style={[styles.ruler, { left: keyWidth }]}
        accessibilityLabel="피아노롤 눈금자"
        {...ruler.panHandlers}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {lines
            .filter((line) => line.beat)
            .map((line) => (
              <View
                key={line.tick}
                style={[
                  styles.rulerMark,
                  {
                    left: line.tick * ppt - scroll.x,
                    top: line.bar ? 0 : rulerHeight * 0.6,
                    borderLeftColor: line.bar ? colors["grid-bar"] : colors["grid-beat"],
                  },
                ]}
              >
                {line.bar && (
                  <Text style={styles.rulerLabel}>
                    {Math.round((line.tick + (roll.projectOriginTick ?? 0)) / ((roll.ppq * 4 * roll.numerator) / roll.denominator)) + 1}
                  </Text>
                )}
              </View>
            ))}
        </View>
      </View>
      <View
        style={[styles.keys, { top: rulerHeight, width: keyWidth }]}
        {...keys.panHandlers}
      >
        {visibleRows.map((pitch, offset) => {
          const row = firstRow + offset;
          const label = pitchLabel(roll, pitch);
          return (
            <View
              key={pitch}
              pointerEvents="none"
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${label} 미리듣기`}
              style={[
                styles.key,
                roll.drum && styles.drumKey,
                { top: row * rowHeight - scroll.y, height: rowHeight, width: keyWidth },
              ]}
            >
              {roll.drum ? (
                <>
                  <DrumPadIcon kind={drumPadFor(pitch)?.icon ?? "percussion"} color={colors["key-black"]} />
                  <Text style={styles.drumLabel} numberOfLines={2}>
                    {label}
                  </Text>
                </>
              ) : (
                <>
                  {sharp(pitch) && <View style={styles.blackKey} />}
                  {(blackKeyLabels || !sharp(pitch)) && <Text style={[styles.keyLabel,
                    { fontSize: 12 * roll.zoom, lineHeight: 14 * roll.zoom, top: 10 * roll.zoom }]}>{label}</Text>}
                </>
              )}
            </View>
          );
        })}
      </View>
      <View
        style={[styles.grid, { top: rulerHeight, left: keyWidth }]}
        {...grid.panHandlers}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {visibleRows.map((pitch, offset) => (
            <View
              key={pitch}
              style={[
                styles.row,
                {
                  top: (firstRow + offset) * rowHeight - scroll.y,
                  height: rowHeight,
                  backgroundColor:
                    !roll.drum && sharp(pitch) ? colors["grid-row-alt"] : colors["grid-row"],
                },
              ]}
            />
          ))}
          <Svg style={StyleSheet.absoluteFill}>
            {lines.map((line) => {
              const x = line.tick * ppt - scroll.x;
              return (
                <Line
                  key={line.tick}
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={Math.min(viewportHeight, height - scroll.y)}
                  stroke={line.bar ? colors["grid-bar"] : line.beat ? colors["grid-beat"] : colors["grid-cell"]}
                  strokeWidth={line.bar ? 1.5 : 1}
                />
              );
            })}
          </Svg>
          {notes.map((note, index) => {
            const row = rowIndex.get(note.pitch);
            if (row === undefined || row < firstRow || row > lastRow) return null;
            const left = note.startTick * ppt - scroll.x;
            const noteWidth = Math.max(1, note.durationTick * ppt - 1);
            if (left > viewportWidth || left + noteWidth < 0) return null;
            return (
              <View
                key={index}
                accessible
                accessibilityLabel={`${pitchLabel(roll, note.pitch)} 노트, 시작 ${note.startTick} 틱, 길이 ${note.durationTick} 틱`}
                accessibilityState={{ selected: selected.has(index) }}
                style={[
                  styles.note,
                  selected.has(index) && styles.noteSelected,
                  { left, top: row * rowHeight - scroll.y + 1, width: noteWidth, height: rowHeight - 2 },
                ]}
              >
                {roll.drum ? (
                  <DrumPadIcon
                    kind={drumPadFor(note.pitch)?.icon ?? "percussion"}
                    color={colors.fg}
                    size={Math.min(20, rowHeight - 8)}
                  />
                ) : (
                  <Text style={[styles.noteLabel, { fontSize: 12 * roll.zoom, lineHeight: 14 * roll.zoom }]} numberOfLines={1}>
                    {pitchNames[note.pitch % 12]}
                  </Text>
                )}
              </View>
            );
          })}
          {roll.suggestion?.notes.map((note) => {
            const row = rowIndex.get(note.pitch);
            if (row === undefined || row < firstRow || row > lastRow) return null;
            const left = note.startTick * ppt - scroll.x;
            const noteWidth = Math.max(1, note.durationTick * ppt - 1);
            if (left > viewportWidth || left + noteWidth < 0) return null;
            return (
              <View key={`suggestion-${note.pitch}`}
                style={[styles.note, styles.suggestionNote,
                  { left, top: row * rowHeight - scroll.y + 1, width: noteWidth, height: rowHeight - 2 }]}>
                <Text style={styles.noteLabel}>{pitchNames[note.pitch % 12]}</Text>
              </View>
            );
          })}
          {marquee && (
            <View
              style={[
                styles.marquee,
                {
                  left: marquee.left - scroll.x,
                  top: marquee.top - scroll.y,
                  width: marquee.width,
                  height: marquee.height,
                },
              ]}
            />
          )}
        </View>
      </View>
      {ppt > 0 && (
        <Playhead
          roll={roll}
          dragTick={dragTick}
          ppt={ppt}
          scrollX={scroll.x}
          left={keyWidth}
          width={viewportWidth}
          height={Math.min(viewportHeight, height - scroll.y)}
        />
      )}
    </View>
    </View>
  );
}

/** Snap cell, beat and bar lines of the visible window. */
function gridLines(roll: NativeNoteRoll, startTick: number, endTick: number) {
  const step = roll.stepTick;
  const beatTicks = (roll.ppq * 4) / roll.denominator;
  const barTicks = beatTicks * roll.numerator;
  const origin = roll.projectOriginTick ?? 0;
  const lines: { tick: number; beat: boolean; bar: boolean }[] = [];
  if (!(step > 0) || !(beatTicks > 0) || endTick <= startTick) return lines;
  const ticks = new Set<number>();
  for (let tick = Math.ceil(startTick / step) * step; tick <= endTick; tick += step) ticks.add(tick);
  for (let tick = Math.ceil((startTick + origin) / beatTicks) * beatTicks - origin; tick <= endTick; tick += beatTicks) ticks.add(tick);
  for (const tick of [...ticks].sort((a, b) => a - b)) {
    if (tick > roll.maxTick) break;
    const beat = Math.abs((tick + origin) / beatTicks - Math.round((tick + origin) / beatTicks)) < 1e-9;
    const bar = Math.abs((tick + origin) / barTicks - Math.round((tick + origin) / barTicks)) < 1e-9;
    lines.push({ tick, beat, bar });
  }
  return lines;
}

/**
 * The playhead line and ruler handle at the live engine position (re-rendered every frame while playing,
 * apart from the grid). While playing it turns the window when the playhead leaves it, like the web.
 */
function Playhead({
  roll,
  dragTick,
  ppt,
  scrollX,
  left,
  width,
  height,
}: {
  roll: NativeNoteRoll;
  dragTick: number | null;
  ppt: number;
  scrollX: number;
  left: number;
  width: number;
  height: number;
}) {
  const { act } = useScreen();
  const live = useNativeAudioState(roll.engine);
  const playing = roll.engine ? live.playing : roll.playing;
  const tick =
    dragTick ??
    (roll.engine
      ? clamp((live.positionMs - roll.clipStartMs) / roll.tickMs, 0, roll.maxTick)
      : roll.positionTick);
  const windowStart = roll.viewStartTick;
  const target =
    playing && roll.windowTicks > 0 && (tick < windowStart || tick >= windowStart + roll.windowTicks)
      ? Math.floor(tick / roll.windowTicks) * roll.windowTicks
      : null;
  const requested = useRef<number | null>(null);
  useEffect(() => {
    if (target === null || requested.current === target) return;
    requested.current = target;
    act({ type: "roll-view", tick: target });
  }, [act, target]);
  const x = tick * ppt - scrollX;
  if (x < -11 || x > width + 11) return null;
  return (
    <View pointerEvents="none" style={[styles.playheadLayer, { left, width }]}>
      <View style={[styles.playheadHandle, { left: x - 10 }]} />
      <View style={[styles.playhead, { left: x, height }]} />
    </View>
  );
}

const tools: ReadonlyArray<[NativeNoteTool, string, IconName]> = [
  ["draw", "그리기", "pencil"],
  ["select", "선택", "select"],
  ["erase", "지우개", "eraser"],
  ["pan", "이동", "hand"],
];

/** The four edit tools with icon + name; the active one is filled (the web's NoteTools). */
export function NoteTools({ roll, large = false }: { roll: NativeNoteRoll; large?: boolean }) {
  const { act } = useScreen();
  return (
    <View style={[styles.tools, large && styles.toolsLarge]} accessibilityLabel="편집 도구">
      {tools.map(([tool, label, icon]) => {
        const active = roll.tool === tool;
        return (
          <Touchable
            key={tool}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.tool, large && styles.toolLarge, active && styles.toolActive]}
            onPress={() => act({ type: "roll-tool", tool })}
          >
            <Icon name={icon} size={large ? 18 : 13} strokeWidth={2.2} color={active ? colors.fg : colors.muted} />
            <Text style={[large ? styles.toolTextLarge : styles.toolText, active && styles.toolTextActive]}>
              {label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

function IconButton({
  label,
  icon,
  disabled = false,
  danger = false,
  onPress,
}: {
  label: string;
  icon: IconName;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      style={[styles.iconButton, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Icon name={icon} color={danger ? colors.error : colors.fg} />
    </Touchable>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group} accessibilityLabel={label}>
      {children}
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

/** Segmented choice (the web's compact Dropdown) in the controls strip. */
function Segments<T extends number>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon?: IconName;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segments} accessibilityLabel={label}>
      {icon && <Icon name={icon} size={13} color={colors.muted} />}
      {options.map((option) => (
        <Touchable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${option.label}`}
          accessibilityState={{ selected: option.value === value }}
          style={[styles.segment, option.value === value && styles.segmentActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.segmentText, option.value === value && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </Touchable>
      ))}
    </View>
  );
}

const snapOptions = ([4, 8, 16] as const).map((value) => ({ value, label: `1/${value}` }));
const barsOptions = ([1, 2, 4] as const).map((value) => ({ value, label: `${value}마디` }));

/**
 * The grouped strip of the web's NoteEditorControls: tools (unless shown elsewhere), history, snap and
 * window, selection actions, then the drum kit toggle or the chord button. Scrolls horizontally.
 */
export function NoteControls({ roll, tools: showTools = true }: { roll: NativeNoteRoll; tools?: boolean }) {
  const { act } = useScreen();
  const count = roll.selection.length;
  const lastStart = Math.max(0, roll.maxTick - roll.windowTicks);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.controls}
      contentContainerStyle={styles.controlsContent}
      accessibilityLabel="노트 편집 도구"
    >
      {showTools && (
        <>
          <NoteTools roll={roll} />
          <Divider />
        </>
      )}
      <Group label="실행 기록">
        <IconButton
          label="실행 취소"
          icon="undo"
          disabled={!roll.editable || !roll.canUndo}
          onPress={() => act({ type: "roll-undo" })}
        />
        <IconButton
          label="다시 실행"
          icon="redo"
          disabled={!roll.editable || !roll.canRedo}
          onPress={() => act({ type: "roll-redo" })}
        />
      </Group>
      <Divider />
      <Group label="격자와 구간">
        <Segments
          label="스냅"
          icon="magnet"
          value={roll.snapDenominator}
          options={snapOptions}
          onChange={(value) => act({ type: "roll-snap", value })}
        />
        <Segments
          label="표시 마디"
          value={roll.visibleBars}
          options={barsOptions}
          onChange={(value) => act({ type: "roll-bars", value })}
        />
        <IconButton
          label="이전 구간"
          icon="left"
          disabled={roll.viewStartTick <= 0}
          onPress={() => act({ type: "roll-view", tick: roll.viewStartTick - roll.windowTicks })}
        />
        <IconButton
          label="다음 구간"
          icon="right"
          disabled={roll.viewStartTick >= lastStart}
          onPress={() => act({ type: "roll-view", tick: roll.viewStartTick + roll.windowTicks })}
        />
      </Group>
      <Divider />
      <Group label="선택한 노트">
        <View
          style={[styles.count, count > 0 && styles.countActive]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${count}개 선택`}
        >
          <Text style={[styles.countText, count > 0 && styles.countTextActive]}>{count}개</Text>
        </View>
        <IconButton label="전체 선택" icon="checks" onPress={() => act({ type: "roll-select-all" })} />
        <IconButton
          label="선택 해제"
          icon="x"
          disabled={!count}
          onPress={() => act({ type: "roll-clear-selection" })}
        />
        <IconButton label="복사" icon="copy" disabled={!count} onPress={() => act({ type: "roll-copy" })} />
        <IconButton
          label="붙여넣기"
          icon="paste"
          disabled={!roll.editable || !roll.hasClipboard}
          onPress={() => act({ type: "roll-paste" })}
        />
        <IconButton
          label="복제"
          icon="duplicate"
          disabled={!roll.editable || !count}
          onPress={() => act({ type: "roll-duplicate" })}
        />
        <IconButton
          label="삭제"
          icon="trash"
          danger
          disabled={!roll.editable || !count}
          onPress={() => act({ type: "roll-delete" })}
        />
        {roll.canSettings && (
          <IconButton
            label="노트 설정"
            icon="sliders"
            disabled={!roll.editable || count !== 1}
            onPress={() => act({ type: "roll-settings-open" })}
          />
        )}
      </Group>
      {(roll.drum || roll.canChord) && <Divider />}
      {roll.drum ? (
        // Filled while all 47 pads show; hidden notes stay saved and playable.
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`전체 키트${roll.hidden ? `, 숨은 노트 ${roll.hidden}개` : ""}`}
          accessibilityState={{ selected: roll.expandedDrums }}
          style={[styles.pill, roll.expandedDrums && styles.pillActive]}
          onPress={() => act({ type: "roll-drums", expanded: !roll.expandedDrums })}
        >
          <Icon name="drum" size={14} />
          <Text style={[styles.pillText, roll.expandedDrums && styles.pillTextActive]}>전체 키트</Text>
          {roll.hidden > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+{roll.hidden}</Text>
            </View>
          )}
        </Touchable>
      ) : (
        roll.canChord && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="코드 입력"
            accessibilityState={{ disabled: !roll.editable }}
            disabled={!roll.editable}
            style={[styles.pill, !roll.editable && styles.disabled]}
            onPress={() => act({ type: "roll-chords-open" })}
          >
            <Icon name="music" size={14} />
            <Text style={styles.pillTextActive}>코드</Text>
          </Touchable>
        )
      )}
    </ScrollView>
  );
}

/** The note settings and chord sheets of the roll; render once at the screen root (dialog overlays). */
export function NoteRollSheets({ roll }: { roll: NativeNoteRoll }) {
  return (
    <>
      {roll.settings && <NoteSettingsSheet key={roll.settings.key} settings={roll.settings} />}
      {roll.chords && <ChordSheet roll={roll} error={roll.chords.error} />}
    </>
  );
}

/** The web's NoteSettingsDialog: length in snap steps and volume; "울림"/"일단 효과" are not available yet. */
function NoteSettingsSheet({ settings }: { settings: NativeNoteSettings }) {
  const { act } = useScreen();
  const initial = settings.note;
  const [note, setNote] = useState(initial);
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const steps = note.durationTick / settings.stepTick;
  const limits = noteLengthLimits(initial, note, settings.stepTick, settings.maxTick);
  const percent = notePercent(note);
  const commitLength = () => {
    if (lengthDraft !== null && lengthDraft.trim() !== "" && Number.isFinite(Number(lengthDraft)))
      setNote(withNoteLength(initial, note, Number(lengthDraft), settings.stepTick, settings.maxTick));
    setLengthDraft(null);
  };
  const close = () => act({ type: "roll-settings-close" });
  return (
    <Dialog label={`Code : ${pitchNames[note.pitch % 12]}`} onClose={close} style={styles.sheet}>
      <View style={styles.identity}>
        <Text style={styles.sheetTitle}>Code : {pitchNames[note.pitch % 12]}</Text>
        <View style={styles.partPill}>
          <Text style={styles.partText}>{settings.part}</Text>
        </View>
      </View>
      <View style={styles.lengthRow}>
        <Text style={styles.sheetText}>길이 : </Text>
        <TextInput
          accessibilityLabel="노트 길이"
          accessibilityHint={`${limits.min}~${limits.max}`}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectionColor={colors.accent}
          value={lengthDraft ?? String(Math.round(steps * 1000) / 1000)}
          onChangeText={setLengthDraft}
          onBlur={commitLength}
          onSubmitEditing={commitLength}
          style={styles.lengthInput}
        />
      </View>
      {[
        { label: "울림", disabled: true, value: 20 },
        { label: "음량", disabled: false, value: percent },
        { label: "일단 효과", disabled: true, value: 20 },
      ].map((control) => (
        <View key={control.label} style={styles.control}>
          <Text style={styles.controlLabel}>{control.label}</Text>
          <View style={styles.controlRow}>
            <Slider
              value={control.value}
              min={0}
              max={100}
              label={control.disabled ? `${control.label} 기능 준비 중` : "노트 음량"}
              disabled={control.disabled}
              onChange={(value) => setNote(withNotePercent(note, value))}
              style={styles.flex}
            />
            {control.disabled ? (
              <Text style={styles.controlValue}>{control.value}</Text>
            ) : (
              <NumberField
                value={control.value}
                min={1}
                max={100}
                label="노트 음량 직접 입력"
                onChange={(value) => setNote(withNotePercent(note, value))}
              />
            )}
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        <DialogButton label="취소" tone="secondary" onPress={close} />
        <DialogButton
          label="적용"
          onPress={() => act({ type: "roll-settings-apply", index: settings.index, note })}
        />
      </View>
    </Dialog>
  );
}

const octaves = Array.from({ length: 10 }, (_, index) => index - 1);

/** The web's ChordPickerDialog: octave, length, root and quality; the page inserts at the playhead. */
function ChordSheet({ roll, error }: { roll: NativeNoteRoll; error: string | null }) {
  const { act } = useScreen();
  const [octave, setOctave] = useState(4);
  const [root, setRoot] = useState(0);
  const [length, setLength] = useState<ChordLength>("eighth");
  const rootPitch = (octave + 1) * 12 + root;
  const close = () => act({ type: "roll-chords-close" });
  return (
    <Dialog label="코드 입력" onClose={close} style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.chordContent}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          코드 입력
        </Text>
        <Text style={styles.sheetCaption}>옥타브</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
          {octaves.map((value) => (
            <Choice
              key={value}
              label={String(value)}
              accessibilityLabel={`코드 옥타브 ${value}`}
              selected={octave === value}
              onPress={() => setOctave(value)}
            />
          ))}
        </ScrollView>
        <Text style={styles.sheetCaption}>길이</Text>
        <View style={styles.choiceRow}>
          {chordLengths.map((item) => (
            <Choice
              key={item.value}
              label={item.label}
              accessibilityLabel={`코드 길이 ${item.label}`}
              selected={length === item.value}
              onPress={() => setLength(item.value)}
            />
          ))}
        </View>
        <View style={styles.rootGrid} accessibilityLabel="코드 근음">
          {chordRoots.map((item, index) => (
            <Choice
              key={item.name}
              label={`${item.name}${item.alternate ? `/${item.alternate}` : ""}`}
              selected={root === index}
              onPress={() => setRoot(index)}
              style={styles.rootCell}
            />
          ))}
        </View>
        <View style={styles.qualityGrid}>
          {chordQualities.map((quality) => {
            const allowed = roll.editable && chordFits(rootPitch, quality.id, roll);
            return (
              <Touchable
                key={quality.id}
                accessibilityRole="button"
                accessibilityLabel={`${chordRoots[root].name}${quality.suffix || " major"}, ${quality.label}`}
                accessibilityState={{ disabled: !allowed }}
                disabled={!allowed}
                style={[styles.quality, !allowed && styles.qualityDisabled]}
                onPress={() =>
                  act({ type: "roll-chord", octave, root, length, quality: quality.id })
                }
              >
                <Text style={styles.qualityText}>
                  {chordRoots[root].name}
                  {quality.suffix || " major"}
                </Text>
              </Touchable>
            );
          })}
        </View>
        {error && (
          <Text accessibilityRole="alert" style={styles.alert}>
            {error}
          </Text>
        )}
        <View style={styles.actions}>
          <DialogButton label="취소" tone="secondary" onPress={close} />
        </View>
      </ScrollView>
    </Dialog>
  );
}

function Choice({
  label,
  accessibilityLabel,
  selected,
  onPress,
  style,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceActive, style]}
      onPress={onPress}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  suggestionNote: { backgroundColor: "rgba(139, 92, 246, 0.35)", borderColor: colors.accent, borderStyle: "dashed", borderWidth: 1 },
  flex: { flex: 1 },
  disabled: { opacity: 0.35 },
  roll: { flex: 1, overflow: "hidden", backgroundColor: colors.surface },
  corner: {
    position: "absolute",
    left: 0,
    top: 0,
    height: rulerHeight,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 3,
  },
  ruler: {
    position: "absolute",
    top: 0,
    right: 0,
    height: rulerHeight,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rulerMark: { position: "absolute", bottom: 0, borderLeftWidth: 1, paddingLeft: 3 },
  rulerLabel: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  keys: { position: "absolute", left: 0, bottom: 0, overflow: "hidden", zIndex: 2 },
  key: {
    position: "absolute",
    left: 0,
    backgroundColor: colors["key-white"],
    borderBottomWidth: 1,
    borderBottomColor: "#b9b8c2",
  },
  drumKey: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  blackKey: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "66.6%",
    backgroundColor: colors["key-black"],
  },
  keyLabel: {
    position: "absolute",
    top: 10,
    right: 7,
    color: colors["key-black"],
    fontSize: 12,
    lineHeight: 14,
  },
  drumLabel: { flex: 1, color: colors["key-black"], fontSize: 9, lineHeight: 11 },
  grid: { position: "absolute", right: 0, bottom: 0, overflow: "hidden" },
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors["grid-cell"],
  },
  note: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 5,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  noteSelected: { borderWidth: 2, borderColor: colors.fg },
  noteLabel: { color: colors.fg, fontSize: 12, lineHeight: 14 },
  marquee: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "rgba(153, 102, 255, 0.2)",
  },
  playheadLayer: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  playheadHandle: {
    position: "absolute",
    top: 0,
    width: 22,
    height: 26,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.accent,
  },
  playhead: { position: "absolute", top: rulerHeight, width: 2, backgroundColor: colors.accent },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 2,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  toolsLarge: { gap: 4, padding: 4, borderRadius: 12 },
  tool: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  toolLarge: { flex: 1, height: 40, justifyContent: "center", gap: 6, borderRadius: 10 },
  toolActive: { backgroundColor: colors.primary },
  toolText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  toolTextLarge: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  toolTextActive: { color: colors.fg, fontWeight: "700" },
  controls: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  controlsContent: { alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 6 },
  group: { flexDirection: "row", alignItems: "center", gap: 2 },
  divider: { width: 1, height: 20, marginHorizontal: 2, backgroundColor: colors.line },
  iconButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  segments: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  segment: { height: 26, justifyContent: "center", paddingHorizontal: 6, borderRadius: 6 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  segmentTextActive: { color: colors.fg, fontWeight: "700" },
  count: { minWidth: 36, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, alignItems: "center" },
  countActive: { backgroundColor: "rgba(76, 0, 229, 0.25)" },
  countText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  countTextActive: { color: colors.fg, fontWeight: "700" },
  pill: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { color: colors.fg, fontSize: 12, lineHeight: 16 },
  pillTextActive: { color: colors.fg, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  badge: { borderRadius: 999, paddingHorizontal: 4, backgroundColor: colors.bg },
  badgeText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  sheet: { gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitle: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  sheetText: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  sheetCaption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  partPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surface },
  partText: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  lengthRow: { flexDirection: "row", alignItems: "center" },
  lengthInput: {
    minWidth: 72,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    color: colors.fg,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  control: { gap: 6 },
  controlLabel: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  controlValue: { minWidth: 40, textAlign: "center", color: colors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, paddingTop: 12 },
  chordContent: { gap: 10 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rootGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rootCell: { width: "14.5%" },
  qualityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quality: {
    width: "31%",
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  qualityDisabled: { opacity: 0.4 },
  qualityText: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  choice: {
    minWidth: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  choiceActive: { backgroundColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  choiceTextActive: { color: colors.fg, fontWeight: "700" },
  alert: { color: colors.error, fontSize: 14, lineHeight: 20 },
});

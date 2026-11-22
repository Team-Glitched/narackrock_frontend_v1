import assert from "node:assert/strict";
import test from "node:test";
import { NoteEditorSession } from "./note-editor.ts";
import { zoomRollViewport } from "./note-roll-zoom.ts";

const options = {
  contextKey: "zoom-test",
  notes: [
    {
      pitch: 60,
      startTick: 240,
      durationTick: 240,
      velocity: 100,
      effectType: null,
      effectParams: {},
    },
  ],
  ppq: 480,
  signature: { numerator: 4, denominator: 4 },
  instrument: "piano",
  bounds: { maxTick: 16000, minPitch: 0, maxPitch: 127 },
  editable: true,
};

test("zoom changes only the view, cancels editing previews, and preserves history and selection", () => {
  let commits = 0;
  const session = new NoteEditorSession({
    ...options,
    onCommit: () => {
      commits++;
      return true;
    },
  });
  session.select([0]);
  session.execute({ type: "move", indices: [0], deltaTick: 240, deltaRow: 0 });
  const history = session.getSnapshot().history;
  session.beginGesture();
  session.previewGesture({ type: "delete", indices: [0] });
  session.setZoom(2, 4000);
  assert.equal(session.getSnapshot().view.zoom, 2);
  assert.equal(session.getSnapshot().windowTicks, 1920);
  assert.equal(session.getSnapshot().view.viewStartTick, 4000);
  assert.equal(session.getSnapshot().gesture, null);
  assert.strictEqual(session.getSnapshot().history, history);
  assert.equal(commits, 1);
  session.undo();
  assert.equal(session.getSnapshot().history.present.notes[0].startTick, 240);
  assert.equal(session.getSnapshot().view.zoom, 2);
});

test("zoom stays within limits and the last ticks remain reachable", () => {
  const session = new NoteEditorSession({ ...options, onCommit: () => true });
  session.setZoom(99, 99999);
  assert.equal(session.getSnapshot().view.zoom, 2.5);
  assert.equal(
    session.getSnapshot().view.viewStartTick,
    options.bounds.maxTick - session.getSnapshot().windowTicks,
  );
  session.setZoom(0);
  assert.equal(session.getSnapshot().view.zoom, 0.5);
  session.setZoom(Number.NaN);
  assert.equal(session.getSnapshot().view.zoom, 0.5);
});

test("keyboard, pitch rows and time cells scale together while keeping the pinch anchor", () => {
  const from = { x: 180, y: 150 },
    to = { x: 190, y: 170 };
  const before = {
    width: 390,
    height: 450,
    baseKeyWidth: 44,
    baseRowHeight: 40,
    baseWindowTicks: 3840,
    maxTick: 16000,
    rows: 128,
    zoom: 1,
    viewStartTick: 5000,
    scrollTop: 2000,
  };
  const result = zoomRollViewport(before, 2, from, to);
  const beforePpt = (before.width - before.baseKeyWidth) / before.baseWindowTicks;
  const afterPpt =
    (before.width - before.baseKeyWidth * result.zoom) / (before.baseWindowTicks / result.zoom);
  assert.ok(
    Math.abs(5000 + (from.x - 44) / beforePpt - (result.viewStartTick + (to.x - 88) / afterPpt)) <
      1e-8,
  );
  assert.ok(Math.abs((2000 + from.y) / 40 - (result.scrollTop + to.y) / 80) < 1e-8);
});

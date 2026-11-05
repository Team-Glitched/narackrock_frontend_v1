import test from "node:test";
import assert from "node:assert/strict";
import type { MidiNoteDto } from "../../lib/api/composition.ts";
import {
  NoteEditorSession, noteHistoryTransition, noteEditorGeometry,
  type NoteHistoryState, type NoteEditorOptions, type NoteEditorView,
} from "./note-editor.ts";

const note = (pitch = 60, startTick = 0, durationTick = 120): MidiNoteDto => ({
  pitch, startTick, durationTick, velocity: 100, effectType: null, effectParams: {},
});
const emptyHistory = (): NoteHistoryState => ({ past: [], present: { notes: [], selected: [] }, future: [] });
function editor(initial = [note()]) {
  const commits: MidiNoteDto[][] = [];
  let accepts = true;
  let options: NoteEditorOptions = {
    contextKey: "[origin,user,project,track,clip,draft]", notes: initial, ppq: 480,
    signature: { numerator: 4, denominator: 4 }, instrument: "piano",
    bounds: { minPitch: 0, maxPitch: 127, maxTick: 12000 }, editable: true,
    onCommit: (notes) => { if (!accepts) return false; commits.push(notes); return true; },
  };
  const session = new NoteEditorSession(options);
  return {
    session, commits,
    accepting(value: boolean) { accepts = value; },
    configure(changes: Partial<NoteEditorOptions> = {}) {
      options = { ...options, notes: session.getSnapshot().history.present.notes, ...changes };
      session.configure(options);
    },
  };
}

test("history caps past at 80 and restores notes, order and selection on undo/redo", () => {
  let history = emptyHistory();
  for (let i = 0; i < 100; i++) {
    history = noteHistoryTransition(history, { type: "apply", snapshot: { notes: [note(60, i)], selected: [0] } });
  }
  assert.equal(history.past.length, 80);
  assert.equal(history.present.notes[0].startTick, 99);
  history = noteHistoryTransition(history, { type: "select", indices: [] });
  history = noteHistoryTransition(history, { type: "undo" });
  assert.equal(history.present.notes[0].startTick, 98);
  assert.deepEqual(history.present.selected, [0]);
  history = noteHistoryTransition(history, { type: "redo" });
  assert.equal(history.present.notes[0].startTick, 99);
  assert.deepEqual(history.present.selected, []);
});

test("no-op apply and selection preserve redo; only successful new notes clear it", () => {
  let history = emptyHistory();
  history = noteHistoryTransition(history, { type: "apply", snapshot: { notes: [note()], selected: [0] } });
  history = noteHistoryTransition(history, { type: "undo" });
  const same = noteHistoryTransition(history, { type: "apply", snapshot: { notes: [], selected: [] } });
  assert.strictEqual(same, history);
  history = noteHistoryTransition(history, { type: "select", indices: [] });
  assert.equal(history.future.length, 1);
  history = noteHistoryTransition(history, { type: "apply", snapshot: { notes: [note(64)], selected: [0] } });
  assert.equal(history.future.length, 0);
  const reset = noteHistoryTransition(history, { type: "reset", snapshot: { notes: [note(67)], selected: [] } });
  assert.equal(reset.past.length, 0);
  assert.equal(reset.future.length, 0);
});

test("many previews perform zero writes; a release creates exactly one commit/history entry", () => {
  const { session, commits } = editor();
  session.select([0]);
  session.beginGesture();
  for (const deltaTick of [120, 240, 360]) {
    session.previewGesture({ type: "move", indices: [0], deltaTick, deltaRow: 0 });
  }
  assert.equal(commits.length, 0);
  assert.equal(session.getSnapshot().history.present.notes[0].startTick, 0);
  assert.equal(session.getSnapshot().gesture?.result?.snapshot.notes[0].startTick, 360);
  assert.equal(session.commitGesture(), true);
  assert.equal(commits.length, 1);
  assert.equal(session.getSnapshot().history.past.length, 1);
  assert.deepEqual(session.getSnapshot().lastChange?.indexMap, [0]);
  assert.equal(session.undo(), true);
  assert.equal(session.getSnapshot().history.present.notes[0].startTick, 0);
  assert.deepEqual(session.getSnapshot().history.present.selected, [0]);
  assert.equal(session.getSnapshot().lastChange?.type, "undo");
  assert.equal(session.redo(), true);
  assert.equal(session.getSnapshot().history.present.notes[0].startTick, 360);
});

test("cancelled draw and erase previews leave notes, stacks, selection and writes unchanged", () => {
  const { session, commits } = editor([note(), note(64)]);
  session.selectAll();
  const history = session.getSnapshot().history;
  session.beginGesture();
  session.previewGesture({ type: "delete", indices: [0, 1] });
  session.cancelGesture();
  assert.strictEqual(session.getSnapshot().history, history);
  session.beginGesture();
  session.previewGesture({ type: "insert", notes: [note(67)] });
  session.cancelGesture();
  assert.strictEqual(session.getSnapshot().history, history);
  assert.equal(commits.length, 0);
});

test("a final invalid preview rejects the gesture, not its previous valid preview", () => {
  const { session, commits } = editor([note(), note(60, 480)]);
  session.beginGesture();
  session.previewGesture({ type: "move", indices: [0], deltaTick: 120, deltaRow: 0 });
  assert.equal(session.getSnapshot().gesture?.result?.changed, true);
  session.previewGesture({ type: "move", indices: [0], deltaTick: 480, deltaRow: 0 });
  assert.equal(session.commitGesture(), false);
  assert.equal(commits.length, 0);
  assert.equal(session.getSnapshot().history.past.length, 0);
  assert.equal(session.getSnapshot().history.present.notes[0].startTick, 0);
  assert.ok(session.getSnapshot().error);
});

test("rejected external acceptance never advances edit, undo, redo or lastChange", () => {
  const fixture = editor();
  const { session } = fixture;
  fixture.accepting(false);
  assert.equal(session.execute({ type: "insert", notes: [note(64)] }), false);
  assert.equal(session.getSnapshot().history.past.length, 0);
  assert.equal(session.getSnapshot().lastChange, null);
  fixture.accepting(true);
  assert.equal(session.execute({ type: "insert", notes: [note(64)] }), true);
  const applied = session.getSnapshot().history;
  fixture.accepting(false);
  assert.equal(session.undo(), false);
  assert.strictEqual(session.getSnapshot().history, applied);
  fixture.accepting(true);
  assert.equal(session.undo(), true);
  const undone = session.getSnapshot().history;
  fixture.accepting(false);
  assert.equal(session.redo(), false);
  assert.strictEqual(session.getSnapshot().history, undone);
});

test("metadata/ack updates retain history and clipboard; actual external restore clears both", () => {
  const fixture = editor();
  const { session } = fixture;
  session.select([0]);
  session.copy();
  session.execute({ type: "insert", notes: [note(64)] });
  session.setTool("select");
  session.setSnapDenominator(16);
  const history = session.getSnapshot().history;
  fixture.configure({ ppq: 960, instrument: "electric-piano", notes: structuredClone(history.present.notes) });
  assert.strictEqual(session.getSnapshot().history, history);
  assert.equal(session.getSnapshot().clipboard.length, 1);
  assert.equal(session.getSnapshot().view.snapDenominator, 16);
  assert.equal(session.getSnapshot().view.tool, "select");
  fixture.configure({ notes: [note(72)] });
  assert.equal(session.getSnapshot().history.past.length, 0);
  assert.equal(session.getSnapshot().clipboard.length, 0);
  assert.deepEqual(session.getSnapshot().history.present.selected, []);
  assert.equal(session.getSnapshot().view.tool, "select");
  fixture.configure({ contextKey: "another-draft" });
  assert.equal(session.getSnapshot().view.tool, "draw");
  assert.equal(session.getSnapshot().view.snapDenominator, 8);
});

test("undo is revalidated against changed timeline and instrument without moving its stacks", () => {
  const fixture = editor([note(60, 5000)]);
  const { session } = fixture;
  session.execute({ type: "replace", index: 0, note: note(60, 0) });
  fixture.configure({ bounds: { minPitch: 0, maxPitch: 127, maxTick: 1920 } });
  const before = session.getSnapshot().history;
  assert.equal(session.undo(), false);
  assert.strictEqual(session.getSnapshot().history, before);
  assert.equal(fixture.commits.length, 1);
  fixture.configure({ bounds: { minPitch: 0, maxPitch: 127, maxTick: 12000 }, instrument: "drum-kit" });
  assert.equal(session.undo(), true); // Both notes are valid General MIDI percussion pitches.
  fixture.configure({ bounds: { minPitch: 35, maxPitch: 50, maxTick: 12000 } });
  const restored = session.getSnapshot().history;
  assert.equal(session.redo(), false);
  assert.strictEqual(session.getSnapshot().history, restored);
});

test("permission loss cancels a gesture and all attempted mutations; audition-independent selection stays usable", () => {
  const fixture = editor();
  const { session } = fixture;
  session.beginGesture();
  session.previewGesture({ type: "insert", notes: [note(64)] });
  fixture.configure({ editable: false });
  assert.equal(session.getSnapshot().gesture, null);
  assert.equal(session.commitGesture(), false);
  assert.equal(session.execute({ type: "delete", indices: [0] }), false);
  session.selectAll();
  assert.deepEqual(session.getSnapshot().history.present.selected, [0]);
  assert.equal(session.copy(), true);
  assert.equal(fixture.commits.length, 0);
});

test("view geometry keeps snap denominator separate from meter and clamps window after timing changes", () => {
  const fixture = editor();
  const { session } = fixture;
  session.setViewStartTick(12000);
  assert.equal(session.getSnapshot().view.viewStartTick, 8160);
  session.setSnapDenominator(16);
  assert.equal(session.getSnapshot().bounds.stepTick, 120);
  assert.equal(session.getSnapshot().windowTicks, 3840);
  session.setVisibleBars(4);
  assert.equal(session.getSnapshot().view.viewStartTick, 4320);
  fixture.configure({ signature: { numerator: 3, denominator: 4 } });
  assert.equal(session.getSnapshot().windowTicks, 5760);
  assert.equal(session.getSnapshot().bounds.stepTick, 120);
  fixture.configure({ bounds: { minPitch: 0, maxPitch: 127, maxTick: 1000 } });
  assert.equal(session.getSnapshot().view.viewStartTick, 0);
  const view: NoteEditorView = { ...session.getSnapshot().view, snapDenominator: 8, visibleBars: 2 };
  const geometry = noteEditorGeometry({
    contextKey: "odd-meter", notes: [], ppq: 480, signature: { numerator: 17, denominator: 3 },
    instrument: "piano", bounds: { minPitch: 0, maxPitch: 127, maxTick: 12000 }, editable: true,
  }, view);
  assert.equal(geometry.bounds.stepTick, 240);
  assert.equal(geometry.windowTicks, 21760);
});

test("delete publishes survivor mapping; rejected/no-op commands retain redo and change revision", () => {
  const { session } = editor([note(), note(64), note(67)]);
  session.select([1, 2]);
  session.execute({ type: "delete", indices: [1] });
  assert.deepEqual(session.getSnapshot().lastChange?.indexMap, [0, null, 1]);
  assert.deepEqual(session.getSnapshot().history.present.selected, [1]);
  assert.equal(session.getSnapshot().lastChange?.commandType, "delete");
  session.undo();
  const before = session.getSnapshot();
  assert.equal(session.execute({ type: "move", indices: [0], deltaTick: 0, deltaRow: 0 }), false);
  assert.strictEqual(session.getSnapshot().history, before.history);
  assert.equal(session.getSnapshot().lastChange?.revision, before.lastChange?.revision);
  assert.equal(session.getSnapshot().history.future.length, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import type { MidiNoteDto } from "../../lib/api/composition.ts";
import {
  applyNoteEdit, canPlaceNotes, copyNotes, moveNotes, pasteNotes, resizeNotes, sameNotes,
  type NoteEditBounds, type NoteEditorSnapshot,
} from "./note-editing.ts";

const note = (pitch = 60, startTick = 0, durationTick = 120): MidiNoteDto => ({
  pitch, startTick, durationTick, velocity: 100, effectType: null, effectParams: {},
});
const bounds: NoteEditBounds = {
  maxTick: 1920, minPitch: 0, maxPitch: 127, stepTick: 120,
  rows: Array.from({ length: 128 }, (_, row) => 127 - row),
};
const snapshot = (notes: MidiNoteDto[], selected = notes.map((_, index) => index)): NoteEditorSnapshot => ({ notes, selected });

test("group movement uses one clamped delta and keeps array ordering", () => {
  const original = snapshot([note(60, 120), note(64, 240), note(67, 0)]);
  const result = applyNoteEdit(original, { type: "move", indices: [0, 1], deltaTick: -500, deltaRow: -100 }, bounds);
  assert.equal(result.changed, true);
  assert.deepEqual(result.snapshot.notes.map((n) => [n.pitch, n.startTick]), [[123, 0], [127, 120], [67, 0]]);
  assert.deepEqual(result.indexMap, [0, 1, 2]);
  assert.deepEqual(original.notes.map((n) => n.startTick), [120, 240, 0]);
});

test("one collided group member rejects the whole movement; touching endpoints are allowed", () => {
  const original = snapshot([note(60), note(64), note(60, 240)]);
  const result = applyNoteEdit(original, { type: "move", indices: [0, 1], deltaTick: 180, deltaRow: 0 }, bounds);
  assert.equal(result.changed, false);
  assert.strictEqual(result.snapshot, original);
  assert.ok(result.error);
  assert.equal(canPlaceNotes([note()], [note(60, 120)], bounds), true);
  assert.strictEqual(moveNotes(original.notes, new Set([0, 1]), 180, 0, bounds), original.notes);
});

test("resize preserves imported sub-grid lengths and uses one shared delta", () => {
  const notes = [note(60, 0, 30), note(64, 0, 240)];
  const unchanged = applyNoteEdit(snapshot(notes), { type: "resize", indices: [0, 1], deltaTick: -120 }, bounds);
  assert.equal(unchanged.changed, false);
  const longer = applyNoteEdit(snapshot(notes), { type: "resize", indices: [0, 1], deltaTick: 90 }, bounds);
  assert.deepEqual(longer.snapshot.notes.map((n) => n.durationTick), [120, 330]);
  assert.deepEqual(resizeNotes(notes, new Set([0, 1]), 90, 120, bounds), longer.snapshot.notes);
});

test("deletion maps every survivor and remaps selection without adding wire IDs", () => {
  const result = applyNoteEdit(snapshot([note(60), note(64), note(67)], [1, 2]), { type: "delete", indices: [1] }, bounds);
  assert.deepEqual(result.indexMap, [0, null, 1]);
  assert.deepEqual(result.snapshot.selected, [1]);
  assert.deepEqual(result.snapshot.notes.map((n) => n.pitch), [60, 67]);
  assert.equal(Object.hasOwn(result.snapshot.notes[0], "id"), false);
});

test("clipboard deep-copies nested effects and normalizes the earliest note to zero", () => {
  const notes = [note(60, 240), note(64, 360)];
  notes[0].effectParams = { modulation: { values: [1, 2] } };
  const copied = copyNotes(notes, new Set([0, 1]));
  assert.deepEqual(copied.map((n) => n.startTick), [0, 120]);
  const modulation = copied[0].effectParams.modulation;
  assert.ok(modulation && typeof modulation === "object" && "values" in modulation);
  assert.ok(Array.isArray(modulation.values));
  modulation.values.push(3);
  assert.deepEqual(notes[0].effectParams, { modulation: { values: [1, 2] } });
  const pasted = pasteNotes([], copied, 0, bounds);
  assert.notStrictEqual(pasted[0].effectParams, copied[0].effectParams);
});

test("paste snaps the local playhead and advances origins past actual blockers", () => {
  const original = snapshot([note(60, 120, 240), note(64, 480, 240)], []);
  const result = applyNoteEdit(original, { type: "paste", notes: [note(60), note(64, 120)], atTick: 179.5 }, bounds);
  assert.equal(result.changed, true);
  assert.deepEqual(result.snapshot.notes.slice(2).map((n) => n.startTick), [600, 720]);
  assert.deepEqual(result.snapshot.selected, [2, 3]);
  assert.deepEqual(result.indexMap, [0, 1]);
});

test("a group that cannot fit never partially inserts or duplicates backward", () => {
  const original = snapshot([note(60, 0, 1920)]);
  const pasted = applyNoteEdit(original, { type: "paste", notes: [note(), note(64)], atTick: 0 }, bounds);
  assert.strictEqual(pasted.snapshot, original);
  assert.equal(pasted.changed, false);
  const atEnd = snapshot([note(60, 1800, 120)]);
  assert.strictEqual(applyNoteEdit(atEnd, { type: "duplicate", indices: [0] }, bounds).snapshot, atEnd);
});

test("duplicate starts after the selected group's last end and selects only its copies", () => {
  const original = snapshot([note(60, 120), note(64, 240, 240)]);
  const result = applyNoteEdit(original, { type: "duplicate", indices: [0, 1] }, bounds);
  assert.deepEqual(result.snapshot.notes.slice(2).map((n) => n.startTick), [480, 600]);
  assert.deepEqual(result.snapshot.selected, [2, 3]);
});

test("invalid velocity, pitch, time, replacement and stale indices are atomic failures", () => {
  const original = snapshot([note()]);
  for (const bad of [
    { ...note(64), velocity: -1 }, { ...note(64), velocity: 128 },
    { ...note(64), velocity: 1.5 }, note(128), note(-1), note(64, 0.5),
    note(64, 1900, 120), note(64, 0, 0),
  ]) {
    const result = applyNoteEdit(original, { type: "insert", notes: [bad] }, bounds);
    assert.strictEqual(result.snapshot, original);
    assert.ok(result.error);
  }
  assert.equal(canPlaceNotes([], [{ ...note(), velocity: 0 }], bounds), true);
  assert.equal(applyNoteEdit(original, { type: "replace", index: 99, note: note() }, bounds).changed, false);
  assert.equal(applyNoteEdit(original, { type: "delete", indices: [99] }, bounds).changed, false);
});

test("10,000 notes are accepted exactly; crossing the limit rejects the entire batch", () => {
  const notes = Array.from({ length: 9999 }, (_, index) => note(index % 128, Math.floor(index / 128), 1));
  const largeBounds = { ...bounds, maxTick: 10000 };
  const original = snapshot(notes, []);
  const accepted = applyNoteEdit(original, { type: "insert", notes: [note(127, 100, 1)] }, largeBounds);
  assert.equal(accepted.snapshot.notes.length, 10000);
  const rejected = applyNoteEdit(accepted.snapshot, { type: "insert", notes: [note(126, 101, 1)] }, largeBounds);
  assert.equal(rejected.changed, false);
  assert.strictEqual(rejected.snapshot, accepted.snapshot);
});

test("semantic note equality ignores object key order, not note order or velocity", () => {
  const first = { ...note(), effectParams: { amount: 1, nested: { a: 2, b: [3] } } };
  const reordered = { ...note(), effectParams: { nested: { b: [3], a: 2 }, amount: 1 } };
  assert.equal(sameNotes([first], [reordered]), true);
  assert.equal(sameNotes([first], [{ ...reordered, velocity: 0 }]), false);
  assert.equal(sameNotes([note(60), note(64)], [note(64), note(60)]), false);
});

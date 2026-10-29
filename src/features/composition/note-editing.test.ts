import test from "node:test";
import assert from "node:assert/strict";
import { canPlaceNotes, copyNotes, moveNotes, pasteNotes, resizeNotes } from "./note-editing.ts";
import type { MidiNoteDto } from "../../lib/api/composition.ts";

const bounds = { maxTick: 3840, minPitch: 0, maxPitch: 127 };
const note = (pitch: number, startTick: number, durationTick = 480): MidiNoteDto =>
  ({ pitch, startTick, durationTick, velocity: 83, effectType: "custom", effectParams: { value: 3 } });
const selected = new Set([0, 1]);

test("group movement preserves timing, intervals, velocities and effects across the full MIDI range", () => {
  const notes = [note(21, 240), note(108, 960)];
  const result = moveNotes(notes, selected, 480, 5, bounds);
  assert.deepEqual(result.map(n => [n.pitch, n.startTick]), [[26, 720], [113, 1440]]);
  assert.equal(result[0].velocity, 83);
  assert.deepEqual(result[1].effectParams, { value: 3 });
  assert.equal(notes[0].startTick, 240);
  assert.deepEqual(moveNotes(notes, selected, -9999, 9999, bounds).map(n => [n.pitch, n.startTick]), [[40, 0], [127, 720]]);
});

test("colliding movement and resizing reject the whole group", () => {
  const notes = [note(60, 0), note(64, 0), note(64, 960)];
  assert.strictEqual(moveNotes(notes, selected, 960, 0, bounds), notes);
  assert.strictEqual(resizeNotes(notes, selected, 720, 120, bounds), notes);
  assert.deepEqual(resizeNotes(notes, selected, -9999, 120, bounds).map(n => n.durationTick), [120, 120, 480]);
});

test("group edits clamp to drum range and timeline without collapsing notes", () => {
  const notes = [note(36, 240), note(42, 960)];
  const result = moveNotes(notes, selected, 9999, -9999, { ...bounds, minPitch: 35, maxPitch: 81 });
  assert.deepEqual(result.map(n => n.pitch), [35, 41]);
  assert.equal(result[1].startTick + result[1].durationTick, bounds.maxTick);
});

test("copy and paste retain all MIDI properties, isolate effect objects, and preserve relative timing", () => {
  const notes = [note(60, 240), note(67, 960)];
  const clipboard = copyNotes(notes, selected);
  const pasted = pasteNotes(notes, clipboard, 1920, bounds);
  assert.equal(pasted.length, 4);
  assert.deepEqual(pasted.slice(2).map(n => n.startTick), [1920, 2640]);
  pasted[2].effectParams.value = 9;
  assert.equal(notes[0].effectParams.value, 3);
  assert.equal(clipboard[0].effectParams.value, 3);
});

test("paste near the end keeps the group in bounds and skips occupied positions", () => {
  const clipboard = [note(60, 0), note(64, 720)];
  const pasted = pasteNotes([], clipboard, 3840, bounds);
  assert.equal(pasted[1].startTick + pasted[1].durationTick, 3840);
  const existing = [note(60, 0)];
  assert.deepEqual(pasteNotes(existing, clipboard, 0, bounds).slice(1).map(n => n.startTick), [480, 1200]);
  assert.equal(canPlaceNotes([], [note(34, 0)], { ...bounds, minPitch: 35, maxPitch: 81 }), false);
  assert.equal(canPlaceNotes([], [note(60, 0), note(60, 240)], bounds), false);
});

test("empty selections, imported short notes, and the server's note-count limit are safe", () => {
  const notes = [note(60, 0, 60)];
  assert.deepEqual(copyNotes(notes, new Set()), []);
  assert.strictEqual(moveNotes(notes, new Set(), 240, 1, bounds), notes);
  assert.equal(resizeNotes(notes, new Set([0]), -240, 120, bounds)[0].durationTick, 60);
  assert.equal(canPlaceNotes(Array.from({ length: 10_000 }, () => note(60, 0)), [note(72, 0)], bounds), false);
});


test("paste searches forward across chained collisions on different group pitches", () => {
  const existing = [note(60, 0), note(60, 480), note(64, 1200)];
  const clipboard = [note(60, 0), note(64, 240)];
  const result = pasteNotes(existing, clipboard, 0, bounds);
  assert.deepEqual(result.slice(3).map(n => n.startTick), [1440, 1680]);
  assert.deepEqual(result.slice(0, 3), existing);
  assert.deepEqual(result.slice(3).map(n => n.velocity), [83, 83]);
});

test("paste never wraps backwards or overwrites notes when no later gap fits", () => {
  const existing = [note(60, 0, 960)];
  assert.strictEqual(pasteNotes(existing, [note(60, 0)], 0, { ...bounds, maxTick: 960 }), existing);
  assert.strictEqual(pasteNotes(existing, [note(60, 0)], 480, { ...bounds, maxTick: 960 }), existing);
});

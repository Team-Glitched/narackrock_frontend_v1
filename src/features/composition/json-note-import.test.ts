import assert from "node:assert/strict";
import test from "node:test";
import { positionJsonNotes, readJsonNotes } from "./json-note-import.ts";
import { applyNoteEdit } from "./note-editing.ts";

const note = { pitch: 60, startTick: 1, durationTick: 1, velocity: 96 };
const file = (midiNotes: unknown[]) =>
  new File([JSON.stringify({ schemaVersion: 1, ppq: 480, midiNotes })], "notes.json");

test("imports clip-local ticks after existing notes and preserves minimum length", async () => {
  const imported = await readJsonNotes(file([note]));
  const positioned = positionJsonNotes(imported, 120, 240);
  assert.deepEqual(positioned, [
    { ...note, startTick: 240, effectType: null, effectParams: {} },
  ]);
});

test("rejects malformed UTF-8, an oversized file, and invalid notes", async () => {
  await assert.rejects(readJsonNotes(new File([Uint8Array.of(255)], "notes.json")), /UTF-8/);
  await assert.rejects(readJsonNotes(new File([new Uint8Array(1024 ** 2 + 1)], "notes.json")), /1 MiB/);
  await assert.rejects(readJsonNotes(file([note, { ...note, velocity: 0 }])), /midiNotes\[1\]\.velocity/);
});

test("the editor rejects the entire import when one note exceeds its bounds", async () => {
  const imported = await readJsonNotes(file([note, { ...note, startTick: 20 }]));
  const snapshot = { notes: [], selected: [] };
  const result = applyNoteEdit(snapshot, { type: "insert", notes: imported }, {
    maxTick: 20, minPitch: 0, maxPitch: 127, stepTick: 1, rows: [],
  });
  assert.equal(result.changed, false);
  assert.deepEqual(result.snapshot, snapshot);
});

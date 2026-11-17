import assert from "node:assert/strict";
import test from "node:test";
import { importJsonNoteFile, positionJsonNotes, readJsonNotes } from "./json-note-import.ts";
import { validateNotes } from "./note-editing.ts";

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

test("back-to-back notes of one pitch stay adjacent when the project ppq rounds ticks", async () => {
  const imported = await readJsonNotes(file([
    { ...note, startTick: 2, durationTick: 6 },
    { ...note, startTick: 8, durationTick: 6 },
  ]));
  const positioned = positionJsonNotes(imported, 120, 0);
  assert.equal(positioned[0].startTick + positioned[0].durationTick, positioned[1].startTick);
  assert.equal(validateNotes(positioned, { maxTick: 100, minPitch: 0, maxPitch: 127 }), null);
});
test("rejects malformed UTF-8, an oversized file, and invalid notes", async () => {
  await assert.rejects(readJsonNotes(new File([Uint8Array.of(255)], "notes.json")), /UTF-8/);
  await assert.rejects(readJsonNotes(new File([new Uint8Array(1024 ** 2 + 1)], "notes.json")), /1 MiB/);
  await assert.rejects(readJsonNotes(file([note, { ...note, velocity: 0 }])), /midiNotes\[1\]\.velocity/);
});

test("an import with a note past the clip end adds nothing", async () => {
  const executed: unknown[] = [];
  const editor = {
    snapshot: { notes: [] },
    bounds: { maxTick: 20, minPitch: 0, maxPitch: 127 },
    execute: (command: unknown) => (executed.push(command), true),
  };
  await assert.rejects(
    importJsonNoteFile(editor, file([note, { ...note, startTick: 20 }]), 480),
    /최대 길이/,
  );
  assert.deepEqual(executed, []);
});

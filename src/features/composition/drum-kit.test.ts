import assert from "node:assert/strict";
import test from "node:test";
import { basicDrumPads, basicDrumPitches, drumPitches, moveDrumNotes } from "./drum-kit.ts";
import type { MidiNoteDto } from "../../lib/api/composition.ts";
const note = (pitch: number, startTick = 0): MidiNoteDto => ({ pitch, startTick, durationTick: 240, velocity: 91, effectType: null, effectParams: {} });
const bounds = { maxTick: 3840, minPitch: 35, maxPitch: 81 };

test("basic kit contains the eleven requested pieces with their existing GM MIDI pitches", () => {
  assert.equal(basicDrumPads.length, 11);
  assert.equal(new Set(basicDrumPitches).size, 11);
  assert.deepEqual([...basicDrumPitches].sort((a,b)=>a-b), [36,38,41,42,46,47,49,50,51,53,57]);
  assert.equal(basicDrumPads.filter(p=>p.icon.startsWith("crash")).length,2);
  assert.equal(basicDrumPads.filter(p=>p.icon.startsWith("ride")).length,2);
  assert.equal(basicDrumPads.filter(p=>p.icon.startsWith("tom")).length,3);
});
test("expanding retains every legacy percussion pitch without changing notes", () => {
  const expanded = drumPitches(true);
  assert.equal(expanded.length,47);
  assert.equal(expanded[0],81); assert.equal(expanded.at(-1),35);
  assert.ok(expanded.includes(39)); assert.ok(!drumPitches(false).includes(39));
});
test("moving a kick up one row produces snare rather than a hidden rimshot", () => {
  const result=moveDrumNotes([note(36)],new Set([0]),240,-1,basicDrumPitches,bounds);
  assert.equal(result[0].pitch,38);assert.equal(result[0].startTick,240);assert.equal(result[0].velocity,91);
});
test("group movement preserves row spacing and stops at the kit edge atomically", () => {
  const notes=[note(38),note(36)];
  const result=moveDrumNotes(notes,new Set([0,1]),0,-100,basicDrumPitches,bounds);
  assert.deepEqual(result.map(n=>n.pitch),[49,57]);
  assert.deepEqual(notes.map(n=>n.pitch),[38,36]);
});
test("drum collisions reject the entire move", () => {
  const notes=[note(36),note(38)];
  assert.strictEqual(moveDrumNotes(notes,new Set([0]),0,-1,basicDrumPitches,bounds),notes);
});
test("legacy hidden pitches keep their data and can still move horizontally", () => {
  const notes=[note(39)];
  assert.strictEqual(moveDrumNotes(notes,new Set([0]),0,-1,basicDrumPitches,bounds),notes);
  assert.equal(moveDrumNotes(notes,new Set([0]),240,0,basicDrumPitches,bounds)[0].startTick,240);
  assert.equal(moveDrumNotes(notes,new Set([0]),0,-1,drumPitches(true),bounds)[0].pitch,40);
});

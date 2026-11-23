import assert from "node:assert/strict";
import test from "node:test";
import { emptyMidiRange, isEmptyMidi, midiContent } from "./midi-content.ts";

const timing = { bpm: 120, ppq: 480, maxTick: Infinity };

test("deleting the last notes shrinks the content and clearing preserves its position for undo", () => {
  assert.deepEqual(midiContent(960, [], timing), { startTick: 960, durationTick: 120, midiNotes: [] });
  const notes = [{ startTick: 240, durationTick: 60 }];
  assert.equal(midiContent(960, notes, timing).durationTick, 300);
  assert.equal(midiContent(960, notes, timing).startTick, 960);
  assert.equal(midiContent(960, [{ startTick: 0, durationTick: 30 }], timing).durationTick, 30);
});

test("an empty clip near the limit keeps its start with a shorter placeholder", () => {
  // A 30-tick clip 60 ticks before the end: clearing it must not move it, so undo restores in place.
  assert.deepEqual(emptyMidiRange(28_740, 480, 28_800), { startTick: 28_740, durationTick: 60 });
  assert.deepEqual(midiContent(28_740, [], { ...timing, maxTick: 28_800 }), {
    startTick: 28_740,
    durationTick: 60,
    midiNotes: [],
  });
  assert.deepEqual(emptyMidiRange(28_799, 480, 28_800), { startTick: 28_799, durationTick: 1 });
});

test("an old empty range outside the current BPM remains editable", () => {
  const limited = { ...timing, maxTick: 28_800 };
  assert.deepEqual(emptyMidiRange(40_000, 480, 28_800), { startTick: 0, durationTick: 120 });
  assert.deepEqual(emptyMidiRange(28_800, 480, 28_800), { startTick: 0, durationTick: 120 });
  assert.equal(midiContent(960, [], limited).startTick, 960);
  // Actual notes retain their position so the caller can reject content exceeding the limit.
  assert.equal(midiContent(40_000, [{ startTick: 0, durationTick: 480 }], limited).startTick, 40_000);
});

test("a tiny clip spans at least one whole millisecond after the backend floors it", () => {
  const fast = { bpm: 150, ppq: 480, maxTick: 28_800 };
  const { durationTick } = midiContent(0, [{ startTick: 0, durationTick: 1 }], fast);
  assert.equal(durationTick, 2);
  assert.equal(Math.floor((durationTick * 60_000) / (fast.bpm * fast.ppq)), 1);
  // Longer notes are not padded.
  assert.equal(midiContent(0, [{ startTick: 0, durationTick: 3 }], fast).durationTick, 3);
  assert.equal(midiContent(0, [{ startTick: 0, durationTick: 1 }], { ...fast, bpm: 60 }).durationTick, 1);
});

test("only note-free MIDI counts as empty", () => {
  assert.equal(isEmptyMidi({ clipType: "MIDI", midiNotes: [] }), true);
  assert.equal(isEmptyMidi({ clipType: "AUDIO", midiNotes: [] }), false);
  assert.equal(isEmptyMidi({ clipType: "MIDI" }), false);
});

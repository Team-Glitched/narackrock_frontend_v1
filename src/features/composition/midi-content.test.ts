import assert from "node:assert/strict";
import test from "node:test";
import { emptyMidiChoices, emptyMidiRange, isEmptyMidi, midiContent } from "./midi-content.ts";

const timing = { ppq: 480, maxTick: Infinity };

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

test("a one-tick note at the limit keeps its exact end so import and undo still fit", () => {
  const limited = { ...timing, maxTick: 28_800 };
  const note = [{ startTick: 0, durationTick: 1 }];
  assert.deepEqual(midiContent(28_799, note, limited), {
    startTick: 28_799,
    durationTick: 1,
    midiNotes: note,
  });
});

test("only note-free MIDI counts as empty", () => {
  assert.equal(isEmptyMidi({ clipType: "MIDI", midiNotes: [] }), true);
  assert.equal(isEmptyMidi({ clipType: "AUDIO", midiNotes: [] }), false);
  assert.equal(isEmptyMidi({ clipType: "MIDI" }), false);
});

test("track settings reopen one empty clip directly and name several by position", () => {
  const clip = (clipId: number, startTick: number, notes = 0) => ({
    clipId,
    clipType: "MIDI" as const,
    startTick,
    midiNotes: Array.from({ length: notes }, () => ({ startTick: 0, durationTick: 1 })),
  });
  const four = { numerator: 4, denominator: 4 };
  assert.deepEqual(emptyMidiChoices([clip(1, 0, 2), clip(2, 4_320)], 480, four), [
    { clipId: 2, label: "빈 MIDI 이어서 편집" },
  ]);
  assert.deepEqual(
    emptyMidiChoices([clip(2, 4_320), clip(3, 0), { ...clip(4, 0), clipType: "AUDIO" as const }], 480, four),
    [
      { clipId: 2, label: "3마디 2박 빈 MIDI 편집" },
      { clipId: 3, label: "1마디 1박 빈 MIDI 편집" },
    ],
  );
  // 6/8: a beat is an eighth (240 ticks), six per bar.
  assert.deepEqual(emptyMidiChoices([clip(5, 1_680), clip(6, 0)], 480, { numerator: 6, denominator: 8 })[0], {
    clipId: 5,
    label: "2마디 2박 빈 MIDI 편집",
  });
});

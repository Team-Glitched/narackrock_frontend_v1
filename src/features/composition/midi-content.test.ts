import assert from "node:assert/strict";
import test from "node:test";
import { midiContent } from "./midi-content.ts";

test("deleting the last notes shrinks the content and clearing preserves its position for undo", () => {
  assert.deepEqual(midiContent(960, [], 480), { startTick: 960, durationTick: 120, midiNotes: [] });
  const notes = [{ startTick: 240, durationTick: 60 }];
  assert.equal(midiContent(960, notes, 480).durationTick, 300);
  assert.equal(midiContent(960, notes, 480).startTick, 960);
  assert.equal(midiContent(960, [{ startTick: 0, durationTick: 30 }], 480).durationTick, 30);
});

test("an old empty range outside the current BPM remains editable", () => {
  assert.equal(midiContent(40_000, [], 480, 28_800).startTick, 0);
  assert.equal(midiContent(960, [], 480, 28_800).startTick, 960);
  // Actual notes retain their position so the caller can reject content exceeding the limit.
  assert.equal(midiContent(40_000, [{ startTick: 0, durationTick: 480 }], 480, 28_800).startTick, 40_000);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createHtiMidiLayerPlan } from "./hti-midi-flow.ts";

const note = {
  pitch: 60,
  startTick: 0,
  durationTick: 480,
  velocity: 100,
  effectType: null,
  effectParams: {},
};

test("creates a piano MIDI layer plan from HTI notes", () => {
  const plan = createHtiMidiLayerPlan({ durationTick: 960, midiNotes: [note] }, 4, 28_800);

  assert.equal(plan.name, "MIDI 5");
  assert.equal(plan.sortOrder, 4);
  assert.equal(plan.durationTick, 960);
  assert.deepEqual(plan.midiNotes, [note]);
});

test("rejects an HTI result without detected notes", () => {
  assert.throws(
    () => createHtiMidiLayerPlan({ durationTick: 960, midiNotes: [] }, 0, 28_800),
    /음정을 찾지 못했습니다/,
  );
});

test("rejects an HTI result beyond the project duration", () => {
  assert.throws(
    () => createHtiMidiLayerPlan({ durationTick: 28_801, midiNotes: [note] }, 0, 28_800),
    /최대 길이/,
  );
});

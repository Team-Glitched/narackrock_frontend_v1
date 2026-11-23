import test from "node:test";
import assert from "node:assert/strict";
import { sourceRenderPlan, validateSourceInstrument } from "./source-render-plan.ts";

const note = (pitch: number) => ({
  pitch,
  startTick: 0,
  durationTick: 480,
  velocity: 100,
  effectType: null,
  effectParams: {},
});

test("sample rendering uses the selected composition instrument bank", () => {
  const guitar = sourceRenderPlan([note(61)], 120, "acoustic-guitar");
  assert.equal(guitar.instrument.id, "acoustic-guitar");
  assert.match(guitar.voices[0].url, /^\/audio\/instruments\/acoustic-guitar\/\d+\.mp3$/);
  assert.equal(guitar.voices[0].start, 0);
  assert.equal(guitar.voices[0].end, 0.5);
  assert.equal(guitar.voices[0].velocity, 100 / 127);
  assert.equal(guitar.durationSeconds, 0.58);
  assert.notEqual(sourceRenderPlan([note(61)], 120, "violin").voices[0].url, guitar.voices[0].url);
});

test("drums render exact percussion samples and reject incompatible existing notes", () => {
  const plan = sourceRenderPlan([note(36), note(42)], 120, "drum-kit");
  assert.deepEqual(
    plan.voices.map((v) => [v.sample, v.playbackRate]),
    [
      [36, 1],
      [42, 1],
    ],
  );
  assert.throws(() => validateSourceInstrument([note(90)], "drum-kit"), /음역/);
  assert.throws(() => sourceRenderPlan([note(60)], 120, "vocal"), /피아노롤/);
  assert.throws(() => sourceRenderPlan([note(60)], 120, "unknown"), /피아노롤/);
});

test("sample renders validate duration and keep the one-minute limit", () => {
  assert.throws(() => sourceRenderPlan([], 120, "piano"), /노트/);
  assert.throws(() => sourceRenderPlan([note(60)], 0, "piano"), /BPM/);
  assert.throws(
    () => sourceRenderPlan([{ ...note(60), durationTick: 58080 }], 120, "piano"),
    /1분/,
  );
  assert.equal(
    sourceRenderPlan([{ ...note(60), durationTick: 57600 }], 120, "piano").durationSeconds,
    60,
  );
});

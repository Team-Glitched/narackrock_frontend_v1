import test from "node:test";
import assert from "node:assert/strict";
import { clipLocalTiming, clipPositionTick, projectPositionMs } from "./clip-local-timing.ts";

function approximately(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be close to ${expected}`);
}

test("offset clip rewind and playhead use the same project epoch", () => {
  const timing = clipLocalTiming(120, 480, 57600, 960);
  approximately(timing.clipStartMs, 1000);
  assert.equal(timing.maxTick, 56640);
  approximately(projectPositionMs(0, timing), 1000);
  approximately(clipPositionTick(1000, timing), 0);
  approximately(clipPositionTick(1500, timing), 480);
  approximately(projectPositionMs(480, timing), 1500);
});

test("local seek and playhead clamp to the clip's remaining project extent", () => {
  const timing = clipLocalTiming(120, 480, 1920, 960);
  approximately(clipPositionTick(0, timing), 0);
  approximately(clipPositionTick(10000, timing), 960);
  approximately(projectPositionMs(-480, timing), 1000);
  approximately(projectPositionMs(10000, timing), 2000);
});

test("source piano retains the zero-offset sixty-second timeline across tempos", () => {
  for (const bpm of [60, 120, 137]) {
    const timing = clipLocalTiming(bpm, 480, bpm * 480, 0);
    approximately(projectPositionMs(timing.maxTick, timing), 60000);
    approximately(clipPositionTick(60000, timing), bpm * 480);
    approximately(projectPositionMs(0, timing), 0);
  }
});

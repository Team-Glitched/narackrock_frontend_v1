import assert from "node:assert/strict";
import test from "node:test";
import { RECORD_COUNTDOWN_START, countdownBeatMs } from "./record-countdown.ts";

test("record countdown uses 3 beats synced to project BPM and time signature", () => {
  assert.equal(RECORD_COUNTDOWN_START, 3);
  assert.equal(countdownBeatMs(120, "4/4"), 500);
  assert.ok(Math.abs(countdownBeatMs(90, "3/4") - 60000 / 90) < 0.01);
  assert.equal(countdownBeatMs(120, "6/8"), 250);
});

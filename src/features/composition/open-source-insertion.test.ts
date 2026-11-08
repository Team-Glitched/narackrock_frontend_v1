import test from "node:test";
import assert from "node:assert/strict";
import { clipLocalTiming, clipPositionTick } from "./clip-local-timing.ts";
import { openSourceStartTick, insertThenRefresh } from "./open-source-insertion.ts";

test("an untouched offset clip inserts at its visible start, even before playback has started", () => {
  const timing = clipLocalTiming(120, 480, 57600, 960);
  assert.equal(openSourceStartTick(clipPositionTick(0, timing), timing, 57600), 960);
  assert.equal(openSourceStartTick(480, timing, 57600), 1440);
  assert.equal(openSourceStartTick(timing.maxTick, timing, 57600), 57599);
});

test("a confirmed write remains successful when refreshing the composition fails", async () => {
  let inserts = 0;
  const refreshed = await insertThenRefresh(async () => { inserts++; }, async () => { throw new Error("offline"); });
  assert.equal(refreshed, false);
  assert.equal(inserts, 1);
});

test("an insertion failure stays retryable and never refreshes", async () => {
  let refreshed = false;
  await assert.rejects(insertThenRefresh(async () => { throw new Error("insert failed"); }, async () => { refreshed = true; }), /insert failed/);
  assert.equal(refreshed, false);
});

test("a successful insert and refresh completes normally", async () => {
  const calls: string[] = [];
  assert.equal(await insertThenRefresh(async () => { calls.push("insert"); }, async () => { calls.push("refresh"); }), true);
  assert.deepEqual(calls, ["insert", "refresh"]);
});

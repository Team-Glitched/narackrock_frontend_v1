import assert from "node:assert/strict";
import test from "node:test";
import { meterTiming, rulerBeats } from "./musical-time.ts";

test("quarter and eighth-note meters retain the same MIDI PPQ unit", () => {
  assert.deepEqual(meterTiming(480), { beatTick:480, barTick:1920 });
  assert.deepEqual(meterTiming(480,3,4), { beatTick:480, barTick:1440 });
  assert.deepEqual(meterTiming(480,6,8), { beatTick:240, barTick:1440 });
  assert.deepEqual(meterTiming(960,7,8), { beatTick:480, barTick:3360 });
});
test("3/4 ruler repeats three beats and advances bars at the right ticks", () => {
  const beats = rulerBeats(0,2880,480,3,4);
  assert.deepEqual(beats.map(b=>b.beat),[1,2,3,1,2,3]);
  assert.deepEqual(beats.filter(b=>b.isBar).map(b=>[b.tick,b.bar]),[[0,1],[1440,2]]);
});
test("6/8 counts eighth-note beats including a partially scrolled bar", () => {
  const beats = rulerBeats(1300,800,480,6,8);
  assert.deepEqual(beats.map(b=>[b.tick,b.beat,b.bar]),[[1440,1,2],[1680,2,2],[1920,3,2]]);
  assert.deepEqual(beats.map(b=>b.isBar),[true,false,false]);
});

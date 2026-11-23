import assert from "node:assert/strict";
import test from "node:test";
import {
  beatIntervalMs,
  beatsPerBarFromSignature,
  isAccentBeat,
} from "./metronome-timing.ts";

test("beatIntervalMs converts BPM and clamps invalid or extreme values", () => {
  assert.equal(beatIntervalMs(120), 500);
  assert.equal(beatIntervalMs(60), 1000);
  assert.equal(beatIntervalMs(Number.NaN), 500);
  assert.equal(beatIntervalMs(5), 60_000 / 20);
  assert.equal(beatIntervalMs(900), 60_000 / 300);
});

test("beatIntervalMs spaces beats by the signature's denominator like the studio metronome", () => {
  assert.equal(beatIntervalMs(120, "4/4"), 500);
  assert.equal(beatIntervalMs(120, "6/8"), 250);
  assert.equal(beatIntervalMs(120, "2/2"), 1000);
  assert.equal(beatIntervalMs(120, "invalid"), 500);
});

test("beatsPerBarFromSignature parses valid time signatures and falls back to 4", () => {
  assert.equal(beatsPerBarFromSignature("4/4"), 4);
  assert.equal(beatsPerBarFromSignature("3/4"), 3);
  assert.equal(beatsPerBarFromSignature("6/8"), 6);
  assert.equal(beatsPerBarFromSignature(undefined), 4);
  assert.equal(beatsPerBarFromSignature("invalid"), 4);
});

test("isAccentBeat accents the downbeat of each bar", () => {
  assert.equal(isAccentBeat(0, 4), true);
  assert.equal(isAccentBeat(1, 4), false);
  assert.equal(isAccentBeat(3, 4), false);
  assert.equal(isAccentBeat(4, 4), true);
  assert.equal(isAccentBeat(3, 3), true);
});

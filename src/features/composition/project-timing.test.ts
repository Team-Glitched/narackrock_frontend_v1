import assert from "node:assert/strict";
import test from "node:test";
import { timingFieldText, timingFieldValue, timingProblem, timingSliderBpm } from "./project-timing.ts";

test("timingProblem accepts numerator 1..16 with denominators 1/2/4/8/16 and rejects out-of-range values", () => {
  for (const [numerator, denominator] of [
    [1, 1],
    [4, 4],
    [15, 16],
    [16, 16],
  ]) {
    assert.equal(timingProblem({ bpm: 120, signature: { numerator, denominator } }), null);
  }
  assert.ok(timingProblem({ bpm: 120, signature: { numerator: 0, denominator: 4 } }));
  assert.ok(timingProblem({ bpm: 120, signature: { numerator: 17, denominator: 4 } }));
  assert.ok(timingProblem({ bpm: 120, signature: { numerator: 4, denominator: 3 } }));
  assert.ok(timingProblem({ bpm: 120, signature: { numerator: 4, denominator: 32 } }));
  assert.ok(timingProblem({ bpm: 29, signature: { numerator: 4, denominator: 4 } }));
  assert.ok(timingProblem({ bpm: 301, signature: { numerator: 4, denominator: 4 } }));
});

test("timing fields validate the typed text unrounded", () => {
  const signature = (numerator: string, denominator: string) => ({
    bpm: 120,
    signature: { numerator: timingFieldValue(numerator), denominator: timingFieldValue(denominator) },
  });
  assert.equal(timingProblem(signature("16", "16")), null);
  assert.equal(timingProblem(signature("1", "1")), null);
  // Rounding would turn these into valid 4/4 and 5/4 signatures.
  assert.ok(timingProblem(signature("4", "4.4")));
  assert.ok(timingProblem(signature("4.5", "4")));
  assert.ok(timingProblem(signature("", "4")));
  assert.ok(timingProblem(signature("4", " ")));
  assert.ok(timingProblem({ bpm: timingFieldValue("120.5"), signature: { numerator: 4, denominator: 4 } }));
});

test("timing fields keep showing what was typed until the value changes elsewhere", () => {
  assert.equal(timingFieldText(null, 4), "4");
  assert.equal(timingFieldText("16", 16), "16");
  assert.equal(timingFieldText("", Number.NaN), "");
  assert.equal(timingFieldText("4.50", 4.5), "4.50");
  // The slider moved after typing: show the slider's value.
  assert.equal(timingFieldText("90", 140), "140");
});

test("the BPM slider stays in range while the typed BPM is invalid", () => {
  assert.equal(timingSliderBpm(Number.NaN), 30);
  assert.equal(timingSliderBpm(500), 300);
  assert.equal(timingSliderBpm(10), 30);
  assert.equal(timingSliderBpm(128), 128);
});

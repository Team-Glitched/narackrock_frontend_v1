import assert from "node:assert/strict";
import test from "node:test";
import { timingProblem } from "./project-timing.ts";

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

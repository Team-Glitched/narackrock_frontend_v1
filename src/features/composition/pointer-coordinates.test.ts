import test from "node:test";
import assert from "node:assert/strict";
import { logicalPoint } from "./pointer-coordinates.ts";
test("portrait rotation maps downward drag to advancing notes and leftward drag to lower pitches", () => {
  const start = logicalPoint(100, 100, true);
  const end = logicalPoint(70, 142, true);
  assert.equal(end.x - start.x, 42);
  assert.equal(end.y - start.y, 30);
});
test("landscape pointers preserve their axes", () => {
  assert.deepEqual(logicalPoint(142, 70, false), { x: 142, y: 70 });
});

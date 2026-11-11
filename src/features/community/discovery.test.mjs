import assert from "node:assert/strict";
import test from "node:test";
import { popularSources } from "./discovery.ts";
test("source chart ranks usage count without changing recommendation feed order", () => {
  const items = [
    { id: 1, usageCount: 5 },
    { id: 2 },
    { id: 3, usageCount: 20 },
    { id: 4, usageCount: 5 },
  ];
  assert.deepEqual(
    popularSources(items).map((item) => item.id),
    [3, 4, 1, 2],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    [1, 2, 3, 4],
  );
});

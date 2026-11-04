import test from "node:test";
import assert from "node:assert/strict";
import { collectLegacyItems } from "./legacy-items.ts";

function storage(rows: unknown[]): Storage {
  const key = "narackrock.saved.1";
  return {
    length: 1,
    key: () => key,
    getItem: () => JSON.stringify(rows),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

test("reordering legacy bookmarks cannot attach a completed receipt to a different item", () => {
  const one = { id: 1, kind: "song", title: "one", author: "A" };
  const two = { id: 2, kind: "song", title: "two", author: "B" };
  const initial = collectLegacyItems(storage([one, two]));
  const reordered = collectLegacyItems(storage([two, one]));
  assert.equal(initial[0].key, reordered[1].key);
  assert.equal(initial[1].key, reordered[0].key);
  assert.notEqual(initial[0].key, reordered[0].key);
});

test("the same numeric id with different metadata requires a separate confirmation and receipt", () => {
  const original = collectLegacyItems(
    storage([{ id: 1, kind: "song", title: "one", author: "A" }]),
  )[0];
  const changed = collectLegacyItems(
    storage([{ id: 1, kind: "song", title: "different", author: "B" }]),
  )[0];
  assert.notEqual(original.key, changed.key);
});

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

function pointerStorage(value: unknown): Storage {
  return { ...storage([]), key: () => "glitched-composition-draft-id", getItem: () => JSON.stringify(value) };
}

test("only positive safe numeric or decimal-string global pointers can be adopted", () => {
  for (const value of [42, "42"]) {
    const [item] = collectLegacyItems(pointerStorage(value));
    assert.equal(item.kind, "draft-pointer");
    assert.equal(item.id, 42);
    assert.equal(item.originalScope, "global");
    assert.equal(item.raw, value);
  }
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "0", "-1", "1.5", "01", "1e2", " 2", {}, { id: 42 }, null]) {
    const [item] = collectLegacyItems(pointerStorage(value));
    assert.equal(item.kind, "recovery", JSON.stringify(value));
  }
});

test("a changed global pointer cannot reuse a prior confirmation or receipt", () => {
  const [first] = collectLegacyItems(pointerStorage(42));
  const [changed] = collectLegacyItems(pointerStorage(43));
  assert.notEqual(first.key, changed.key);
  assert.equal(first.key, collectLegacyItems(pointerStorage("42"))[0].key);
});

import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_COVER_COUNT, defaultCoverIndex } from "./default-cover-index.ts";

test("defaultCoverIndex returns valid indices and is deterministic per seed", () => {
  assert.equal(DEFAULT_COVER_COUNT, 5);
  assert.equal(defaultCoverIndex(null), 0);
  assert.equal(defaultCoverIndex(undefined), 0);
  assert.equal(defaultCoverIndex(""), 0);

  for (let id = 1; id <= 50; id += 1) {
    const postIdx = defaultCoverIndex(`post:${id}`);
    const shortIdx = defaultCoverIndex(`short:${id}`);
    assert.ok(postIdx >= 0 && postIdx < DEFAULT_COVER_COUNT);
    assert.ok(shortIdx >= 0 && shortIdx < DEFAULT_COVER_COUNT);
    assert.equal(defaultCoverIndex(`post:${id}`), postIdx);
    assert.equal(defaultCoverIndex(`short:${id}`), shortIdx);
  }
});

test("defaultCoverIndex distributes both posts and songs across all 5 covers", () => {
  const postBuckets = new Set<number>();
  const shortBuckets = new Set<number>();
  for (let id = 1; id <= 30; id += 1) {
    postBuckets.add(defaultCoverIndex(`post:${id}`));
    shortBuckets.add(defaultCoverIndex(`short:${id}`));
  }
  assert.equal(postBuckets.size, DEFAULT_COVER_COUNT);
  assert.equal(shortBuckets.size, DEFAULT_COVER_COUNT);
});

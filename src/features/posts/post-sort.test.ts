import assert from "node:assert/strict";
import test from "node:test";
import { parsePostSort, postSortQuery } from "./post-sort.ts";

test("sort query recognizes the three server sorts and defaults unknown values to latest", () => {
  assert.equal(parsePostSort("POPULAR"), "POPULAR");
  assert.equal(parsePostSort("OLDEST"), "OLDEST");
  for (const value of [null, "LATEST", "popular", "invalid", ""]) {
    assert.equal(parsePostSort(value), "LATEST");
  }
});

test("sorting changes retain unrelated query parameters without mutating the current URL", () => {
  const current = new URLSearchParams("scope=posts&keyword=two+words&sort=LATEST&galleryId=1");
  const next = new URLSearchParams(postSortQuery(current, "OLDEST"));
  assert.equal(next.get("sort"), "OLDEST");
  assert.equal(next.get("scope"), "posts");
  assert.equal(next.get("keyword"), "two words");
  assert.equal(next.get("galleryId"), "1");
  assert.equal(current.get("sort"), "LATEST");
});

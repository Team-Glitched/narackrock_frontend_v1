import assert from "node:assert/strict";
import test from "node:test";
import { resolveSearchScope } from "./search-scope.ts";

test("explicit valid scope wins over community context", () => {
  assert.equal(resolveSearchScope("people", "songs", true), "people");
});

test("invalid query keeps community searches in posts", () => {
  assert.equal(resolveSearchScope("invalid", "sources", true), "posts");
});

test("invalid query outside a community preserves the page's scope", () => {
  assert.equal(resolveSearchScope("invalid", "sources", false), "sources");
});

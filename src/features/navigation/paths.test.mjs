import assert from "node:assert/strict";
import test from "node:test";
import { readId, safeReturnPath } from "./paths.ts";

test("resource IDs reject unsafe and malformed values", () => {
  for (const id of [null, "", "0", "-1", "1.2", "1e2", "NaN", "9007199254740992"])
    assert.equal(readId(id), null);
  assert.equal(readId("42"), 42);
});

test("return paths keep local query and hash while rejecting external destinations", () => {
  for (const path of [
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
    "/\\example.com",
    "/\n/example.com",
    "/folder/..//example.com",
  ])
    assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath(undefined, "/settings"), "/settings");
  assert.equal(
    safeReturnPath("/search?scope=people&q=hello#results"),
    "/search?scope=people&q=hello#results",
  );
});


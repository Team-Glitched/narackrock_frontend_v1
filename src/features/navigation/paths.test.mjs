import assert from "node:assert/strict";
import test from "node:test";
import { readId, safeReturnPath, studioPath, notesPath } from "./paths.ts";

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

test("studio and note-editor links preserve request and approved-view scope", () => {
  assert.equal(studioPath(10, null, { view: "approved" }), "/studio/10?view=approved");
  assert.equal(studioPath(10, null, { contributionId: 200 }), "/studio/10?contributionId=200");
  const notes = new URL(
    notesPath(10, 12, 120, null, { view: "studio", contributionId: 200 }),
    "https://studio.test",
  );
  assert.equal(notes.searchParams.get("contributionId"), "200");
  assert.equal(notes.searchParams.get("view"), "studio");
  assert.equal(notes.searchParams.get("clipId"), "120");
});

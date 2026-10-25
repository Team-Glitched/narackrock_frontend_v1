import test from "node:test";
import assert from "node:assert/strict";
import { screenScope, creationForView } from "../navigation/context-actions.ts";

test("profile searches people while its create action starts a new song", () => {
  for (const view of ["profile", "edit"] as const) {
    const scope = screenScope(view, "posts");
    assert.equal(scope, "people");
    assert.equal(creationForView(view, scope), "song");
  }
});
test("scoped search and social create actions still match their content", () => {
  assert.equal(creationForView("search", "people"), "friend");
  assert.equal(creationForView("social", "posts"), "post");
  assert.equal(creationForView("social", "communities"), "community");
  assert.equal(creationForView("opensource", "sources"), "source");
});

import assert from "node:assert/strict";
import test from "node:test";

import { canJoinShort } from "./short-participation.ts";

const joinableShort = {
  completionStatus: "IN_PROGRESS",
  projectId: 12,
  participants: [{ userId: 7 }],
};

test("hides composition participation after the current user has already participated", () => {
  assert.equal(canJoinShort(joinableShort, 7), false);
});

test("keeps composition participation for a user who has not participated", () => {
  assert.equal(canJoinShort(joinableShort, 8), true);
});

test("does not allow participation in a completed short", () => {
  assert.equal(canJoinShort({ ...joinableShort, completionStatus: "COMPLETED" }, 8), false);
});

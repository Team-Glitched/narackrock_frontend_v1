import assert from "node:assert/strict";
import test from "node:test";

import { abyssStyles } from "../../styles/abyss.styles.ts";

import { canJoinShort } from "./short-participation.ts";


const joinableShort = {
  completionStatus: "IN_PROGRESS" as const,
  projectId: 12,
  hasPendingContribution: false,
  hasApprovedContribution: false,
  participants: [{ userId: 7 }],
};

test("hides composition participation after the current user has already participated", () => {
  assert.equal(canJoinShort(joinableShort, 7), false);
});

test("keeps composition participation for a user who has not participated", () => {
  assert.equal(canJoinShort(joinableShort, 8), true);
});

test("hides composition participation while the current user's request is pending", () => {
  assert.equal(canJoinShort({ ...joinableShort, hasPendingContribution: true }, 8), false);
});

test("hides composition participation after the current user's request was approved", () => {
  assert.equal(canJoinShort({ ...joinableShort, hasApprovedContribution: true }, 8), false);
});

test("does not allow participation in a completed short", () => {
  assert.equal(canJoinShort({ ...joinableShort, completionStatus: "COMPLETED" }, 8), false);
});

test("keeps the original short layout when only the participation button is hidden", () => {
  const classes = new Set(abyssStyles.abyssJoinSlot.split(/\s+/));
  assert.ok(classes.has("abyss-join-slot"));
  assert.ok(classes.has("h-11") && classes.has("flex-[0_0_44px]"));
});

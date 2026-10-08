import assert from "node:assert/strict";
import { test } from "node:test";
import { canCreateLayer, shouldShowContributionSubmit } from "./contribution-session.ts";

const permission = { userId: 22, canContribute: true, canReviewContribution: false };
const track = (ownerId, approvalStatus) => ({ ownerId, clips: [{ ownerId, approvalStatus }] });

test("allows a user to create their first layer in a song", () => {
  assert.equal(canCreateLayer(permission, [track(10, "APPROVED")]), true);
});

test("prevents a user from creating a second layer in the same song", () => {
  assert.equal(canCreateLayer(permission, [track(22, "APPROVED")]), false);
});

test("keeps the add button before the participant saves a layer", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(10, "APPROVED")]), false);
});

test("changes the add button to submit after the participant saves a draft clip", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(22, "DRAFT")]), true);
});

test("uses contribution mode when the studio was opened from a short, even with local test owner permissions", () => {
  assert.equal(shouldShowContributionSubmit(7, { ...permission, canReviewContribution: true }, [track(22, "DRAFT")]), true);
});

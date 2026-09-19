import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowContributionSubmit } from "./contribution-session.ts";

const permission = { userId: 22, canContribute: true, canReviewContribution: false };
const track = (ownerId, approvalStatus) => ({ clips: [{ ownerId, approvalStatus }] });

test("keeps the add button before the participant saves a layer", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(10, "APPROVED")]), false);
});

test("changes the add button to submit after the participant saves a draft clip", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(22, "DRAFT")]), true);
});

test("does not show participant submission controls to the original creator", () => {
  assert.equal(shouldShowContributionSubmit(7, { ...permission, canReviewContribution: true }, [track(22, "DRAFT")]), false);
});

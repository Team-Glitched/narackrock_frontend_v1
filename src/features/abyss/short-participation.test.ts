import assert from "node:assert/strict";
import test from "node:test";

import { shortParticipation } from "./short-participation.ts";

const short = {
  completionStatus: "IN_PROGRESS" as const,
  projectId: 12,
  hasPendingContribution: false,
  hasApprovedContribution: false,
  participants: [{ userId: 7, role: "OWNER" }, { userId: 9, role: "CONTRIBUTOR" }],
};

test("a user with no part in an in-progress song can join it", () => {
  assert.equal(shortParticipation(short, 8), "joinable");
  assert.equal(shortParticipation(short, null), "joinable");
});

test("the song's owner sees their own song, in progress or completed", () => {
  assert.equal(shortParticipation(short, 7), "owner");
  assert.equal(shortParticipation({ ...short, completionStatus: "COMPLETED" }, 7), "owner");
});

test("an approved contribution or a non-owner participant counts as contributed, even after completion", () => {
  assert.equal(shortParticipation({ ...short, hasApprovedContribution: true }, 8), "contributed");
  assert.equal(shortParticipation(short, 9), "contributed");
  assert.equal(shortParticipation({ ...short, completionStatus: "COMPLETED" }, 9), "contributed");
});

test("a pending request is shown until it is approved", () => {
  assert.equal(shortParticipation({ ...short, hasPendingContribution: true }, 8), "pending");
  // A second request after an approval keeps the contributed state.
  assert.equal(
    shortParticipation({ ...short, hasPendingContribution: true, hasApprovedContribution: true }, 8),
    "contributed",
  );
});

test("a completed song offers nothing to a user with no part in it, nor does a short without a project", () => {
  assert.equal(shortParticipation({ ...short, completionStatus: "COMPLETED" }, 8), null);
  assert.equal(shortParticipation({ ...short, projectId: null }, 7), null);
});


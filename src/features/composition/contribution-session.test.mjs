import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canCreateLayer,
  orderStudioTracks,
  shouldShowContributionSubmit,
  shouldOfferSongPublish,
} from "./contribution-session.ts";

const permission = { userId: 22, canContribute: true, canReviewContribution: false };
const track = (ownerId, approvalStatus, originOpenSourceId = null) => ({
  ownerId,
  originOpenSourceId,
  clips: [{ ownerId, approvalStatus }],
});

test("allows a user to create their first layer in a song", () => {
  assert.equal(canCreateLayer(permission, [track(10, "APPROVED")]), true);
});

test("prevents a user from creating a second layer in the same song", () => {
  assert.equal(canCreateLayer(permission, [track(22, "APPROVED")]), false);
});

test("sample tracks do not count against the single regular layer limit", () => {
  assert.equal(canCreateLayer(permission, [track(22, "DRAFT", 301)]), true);
  assert.equal(
    canCreateLayer(permission, [track(22, "DRAFT", 301), track(22, "APPROVED", null)]),
    false,
  );
});

test("orders imported sample tracks below all regular layers while preserving order", () => {
  const ordered = orderStudioTracks([
    { trackId: 1, originOpenSourceId: 301 },
    { trackId: 2, originOpenSourceId: null },
    { trackId: 3, originOpenSourceId: 302 },
    { trackId: 4 },
  ]);
  assert.deepEqual(
    ordered.map((t) => t.trackId),
    [2, 4, 1, 3],
  );
});

test("keeps the add button before the participant saves a layer", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(10, "APPROVED")]), false);
});

test("changes the add button to submit after the participant saves a draft clip", () => {
  assert.equal(shouldShowContributionSubmit(7, permission, [track(22, "DRAFT")]), true);
});

test("uses contribution mode when the studio was opened from a short, even with local test owner permissions", () => {
  assert.equal(
    shouldShowContributionSubmit(7, { ...permission, canReviewContribution: true }, [
      track(22, "DRAFT"),
    ]),
    true,
  );
});

test("participation keeps add-layer action even when export permission exists", () => {
  assert.equal(shouldOfferSongPublish(7, { canExport: true }, [track(10, "APPROVED")]), false);
  assert.equal(shouldOfferSongPublish(null, { canExport: true }, [track(22, "DRAFT")]), true);
});
test("new-song owners can import more layers while participation still permits one", () => {
  const owner = { ...permission, canEdit: true };
  assert.equal(canCreateLayer(owner, [track(22, "DRAFT")], true), true);
  assert.equal(canCreateLayer(owner, [track(22, "DRAFT")], false), false);
  assert.equal(canCreateLayer({ ...owner, canEdit: false, canContribute: false }, [], true), false);
});

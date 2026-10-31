import test from "node:test";
import assert from "node:assert/strict";
import { isCommunityOwner, canManageCommunityMember } from "./permissions.ts";

test("community management requires known ownership and never targets the creator", () => {
  assert.equal(isCommunityOwner({}, 1), false);
  assert.equal(isCommunityOwner({ ownerId: 1 }, null), false);
  assert.equal(isCommunityOwner({ ownerId: 1 }, 2), false);
  assert.equal(isCommunityOwner({ ownerId: 1 }, 1), true);
  assert.equal(canManageCommunityMember({ ownerId: 1 }, 1, 1), false);
  assert.equal(canManageCommunityMember({ ownerId: 1 }, 1, 2), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { canSendChatTo } from "./chat-access.ts";

const profile = (isPrivate: boolean, isFollowing: boolean, isFollowedBy: boolean) => ({
  isPrivate,
  relations: { followerCount: 0, followingCount: 0, isFollowing, isFollowedBy },
});

test("public account can receive a message without a follow", () => {
  assert.equal(canSendChatTo(profile(false, false, false)), true);
});

test("private account requires both follow directions", () => {
  assert.equal(canSendChatTo(profile(true, true, true)), true);
  assert.equal(canSendChatTo(profile(true, true, false)), false);
  assert.equal(canSendChatTo(profile(true, false, true)), false);
  assert.equal(canSendChatTo(profile(true, false, false)), false);
});

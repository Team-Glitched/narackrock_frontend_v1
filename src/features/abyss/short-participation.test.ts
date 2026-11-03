import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canJoinShort, canEditOwnShort } from "./short-participation.ts";

const abyssScreen = readFileSync(new URL("../screens/abyss-screen.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

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
  assert.match(abyssScreen, /className="abyss-join-slot"/);
  assert.match(globalStyles, /\.abyss-join-slot\{[^}]*height:44px[^}]*flex:0 0 44px/);
});


test("only the original owner can reopen an unfinished published song for shared settings", () => {
  const short = { ...joinableShort, author: { userId: 7, nickname: "owner", profileImageUrl: null } };
  assert.equal(canEditOwnShort(short,7),true);
  assert.equal(canEditOwnShort(short,8),false);
  assert.equal(canEditOwnShort(short,null),false);
  assert.equal(canEditOwnShort({ ...short, completionStatus:"COMPLETED" },7),false);
});

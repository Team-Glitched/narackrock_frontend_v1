import assert from "node:assert/strict";
import test from "node:test";
import { buildChatInbox } from "./chat-inbox.ts";
import type { ChatThread, Person } from "../../lib/api/social.ts";

const person = (userId: number): Person => ({ userId, nickname: `user${userId}`, profileImageUrl: null, primaryInstrument: null });
const thread = (userId: number, lastMessageId: number): ChatThread => ({
  ...person(userId), lastMessageId, lastMessage: `message${lastMessageId}`,
  lastMessageAt: "2026-10-19T00:00:00", outgoing: false,
});

test("recent conversations precede mutual followers without messages", () => {
  const result = buildChatInbox([thread(2, 3), thread(3, 9)], [person(1), person(2)]);
  assert.deepEqual(result.map(row => row.userId), [3, 2, 1]);
  assert.equal(result[1].latest?.lastMessage, "message3");
  assert.equal(result[2].latest, null);
});

test("keeps a recent public conversation even without mutual follow", () => {
  assert.deepEqual(buildChatInbox([thread(7, 4)], []).map(row => row.userId), [7]);
});

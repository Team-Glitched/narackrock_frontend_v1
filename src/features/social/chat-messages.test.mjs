import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeChatMessages } from "./chat-messages.ts";

const message = (id, senderId, recipientId) => ({ id, senderId, recipientId, content: `m${id}`, createdAt: "2026-11-04T00:00:00" });

test("a message delivered by send response, socket and backfill appears once in server order", () => {
  const afterSend = mergeChatMessages([message(1, 2, 1)], [message(3, 1, 2)], 1, 2);
  const afterSocket = mergeChatMessages(afterSend, [message(3, 1, 2), message(2, 2, 1)], 1, 2);
  const afterBackfill = mergeChatMessages(afterSocket, [message(1, 2, 1), message(2, 2, 1), message(3, 1, 2)], 1, 2);
  assert.deepEqual(afterBackfill.map((item) => item.id), [1, 2, 3]);
});

test("socket deliveries for other conversations are not shown in this one", () => {
  assert.deepEqual(mergeChatMessages([], [message(5, 3, 1), message(6, 1, 3), message(7, 2, 3)], 1, 2), []);
});

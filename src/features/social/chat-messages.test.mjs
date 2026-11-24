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

test("realtime edit and soft-delete events overwrite existing messages by server ID", () => {
  const initial = [message(1, 1, 2), message(2, 2, 1)];
  const edited = { ...initial[0], content: "updated", editedAt: "2026-11-24T01:00:00" };
  const afterEdit = mergeChatMessages(initial, [edited], 1, 2);
  assert.equal(afterEdit[0].content, "updated");
  assert.equal(afterEdit[0].editedAt, "2026-11-24T01:00:00");
  assert.equal(afterEdit[0].deleted, false);

  const softDeleted = { ...edited, content: "", deleted: true };
  const afterDelete = mergeChatMessages(afterEdit, [softDeleted], 1, 2);
  assert.equal(afterDelete[0].deleted, true);
  assert.equal(afterDelete[0].content, "");
});

test("stale history packets never resurrect deleted messages or revert newer edits", () => {
  const original = message(1, 1, 2);
  const editedV1 = { ...original, content: "edit-1", editedAt: "2026-11-24T01:00:00.100000" };
  const editedV2 = { ...original, content: "edit-2", editedAt: "2026-11-24T01:00:00.200000" };

  // Newer edit stays intact when pre-edit or older-edit history arrives afterwards.
  const afterNewerEdit = mergeChatMessages([original], [editedV2], 1, 2);
  const afterStaleHistory = mergeChatMessages(afterNewerEdit, [original, editedV1], 1, 2);
  assert.equal(afterStaleHistory[0].content, "edit-2");
  assert.equal(afterStaleHistory[0].editedAt, "2026-11-24T01:00:00.200000");

  // Even a later editedAt cannot un-delete a terminal soft-delete tombstone.
  const deleted = { ...editedV2, content: "leftover", deleted: true };
  const afterDelete = mergeChatMessages(afterStaleHistory, [deleted], 1, 2);
  assert.equal(afterDelete[0].deleted, true);
  assert.equal(afterDelete[0].content, "");

  const afterLateHistoryAndEdit = mergeChatMessages(
    afterDelete,
    [original, { ...original, content: "late-edit", editedAt: "2026-11-24T02:00:00" }],
    1,
    2,
  );
  assert.equal(afterLateHistoryAndEdit[0].deleted, true);
  assert.equal(afterLateHistoryAndEdit[0].content, "");
});

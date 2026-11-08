import assert from "node:assert/strict";
import test from "node:test";
import { notificationGroups, notificationBody } from "./notification-groups.ts";
import type { ServiceNotification } from "../../lib/api/notifications.ts";
function item(id: number, type = "POST_LIKED", path = "/posts/1"): ServiceNotification {
  return { id, type, category: "COMMUNITY", actorId: id, title: "좋아요", body: "연주자님이 게시글을 좋아합니다.", path,
    createdAt: "2026-11-09T01:00:00Z", readAt: null, available: true, projectId: null, requestId: null, requestStatus: null };
}
test("reactions group only for the same target, type and day", () => {
  const groups = notificationGroups([item(3), item(2), item(1, "POST_LIKED", "/posts/2")]);
  assert.deepEqual(groups.map((g) => g.items.map((n) => n.id)), [[3, 2], [1]]);
  assert.match(notificationBody(groups[0]), /외 1명이/);
});
test("requests, unavailable targets and different days never merge", () => {
  const items = [item(5, "CONTRIBUTION_CREATED"), item(4, "CONTRIBUTION_CREATED"), { ...item(3), available: false }, item(2), { ...item(1), createdAt: "2026-11-08T01:00:00Z" }];
  assert.equal(notificationGroups(items).length, 5);
});

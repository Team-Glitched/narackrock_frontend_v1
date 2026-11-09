import test from "node:test";
import assert from "node:assert/strict";
import { notificationError } from "./notification-error.ts";
test("connection errors give a Korean retry message while server errors keep their detail", () => {
  assert.match(notificationError(new TypeError("Failed to fetch")), /연결하지 못했습니다/);
  assert.match(notificationError(new TypeError("Load failed")), /다시 시도/);
  assert.equal(notificationError(new Error("이미 처리된 요청입니다.")), "이미 처리된 요청입니다.");
});

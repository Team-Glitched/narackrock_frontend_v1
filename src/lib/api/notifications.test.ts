import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, clearAuthSession, getCurrentUserId, setAuthSession } from "./client.ts";
import { deleteNotification, deleteReadNotifications } from "./notifications.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; clearAuthSession(); });
const session = () => setAuthSession({ userId: 7, accessToken: "valid-access", refreshToken: "valid-refresh" });

test("deletes read notifications with bearer auth and accepts an empty 204 response", async () => {
  session();
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/v1/notifications/read");
    assert.equal(init?.method, "DELETE");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer valid-access");
    return new Response(null, { status: 204 });
  };
  await deleteReadNotifications();
  assert.equal(getCurrentUserId(), 7);
});

test("a missing deletion route is not reported as session expiry when the renewed session works", async () => {
  session();
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(path);
    if (path.endsWith("/refresh")) return Response.json({ data: { accessToken: "renewed-access", refreshToken: "renewed-refresh" } });
    if (path.endsWith("/unread-count")) {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer renewed-access");
      return Response.json({ data: { count: 2 } });
    }
    return new Response(null, { status: 401 });
  };
  await assert.rejects(deleteReadNotifications(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 503);
    assert.match(error.message, /삭제.*지원|삭제.*사용/);
    assert.doesNotMatch(error.message, /만료/);
    return true;
  });
  assert.deepEqual(requests, ["/api/v1/notifications/read", "/api/v1/auth/refresh", "/api/v1/notifications/read", "/api/v1/notifications/unread-count"]);
  assert.equal(getCurrentUserId(), 7);
});

test("real refresh rejection remains an authentication error and clears the expired session", async () => {
  session();
  let count = 0;
  globalThis.fetch = async () => { count++; return new Response(null, { status: 401 }); };
  await assert.rejects(deleteReadNotifications(), (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(count, 2);
  assert.equal(getCurrentUserId(), null);
});

test("an authenticated missing route reports unsupported deletion without claiming success", async () => {
  session();
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(deleteReadNotifications(), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.equal(getCurrentUserId(), 7);
});

test("other server errors are preserved", async () => {
  session();
  globalThis.fetch = async () => Response.json({ message: "삭제 처리 실패" }, { status: 500 });
  await assert.rejects(deleteReadNotifications(), (error: unknown) => error instanceof ApiError && error.status === 500 && error.message === "삭제 처리 실패");
});

test("an expired access token can refresh and delete successfully without a diagnostic request", async () => {
  session();
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(path);
    if (path.endsWith("/refresh")) return Response.json({ data: { accessToken: "renewed-access", refreshToken: "renewed-refresh" } });
    return new Headers(init?.headers).get("Authorization") === "Bearer renewed-access"
      ? Response.json({ success: true, data: null })
      : new Response(null, { status: 401 });
  };
  await deleteReadNotifications();
  assert.equal(getCurrentUserId(), 7);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((path) => !path.endsWith("/unread-count")));
});

test("a protected endpoint also rejecting the renewed token is not called an unsupported feature", async () => {
  session();
  globalThis.fetch = async (input) => String(input).endsWith("/refresh")
    ? Response.json({ data: { accessToken: "renewed-access", refreshToken: "renewed-refresh" } })
    : new Response(null, { status: 401 });
  await assert.rejects(deleteReadNotifications(), (error: unknown) => error instanceof ApiError && error.status === 401);
});

test("deletes a single notification by id with bearer auth and maps missing route to 503", async () => {
  session();
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/v1/notifications/42");
    assert.equal(init?.method, "DELETE");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer valid-access");
    return new Response(null, { status: 204 });
  };
  await deleteNotification(42);
  assert.equal(getCurrentUserId(), 7);

  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(deleteNotification(42), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.equal(getCurrentUserId(), 7);
});

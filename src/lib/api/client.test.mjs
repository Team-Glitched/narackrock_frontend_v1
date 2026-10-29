import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  apiRequest,
  clearAuthSession,
  getAccessToken,
  getCurrentUserId,
  setAuthSession,
} from "./client.ts";

test("retired demo URLs use the real session and backend transport", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  setAuthSession({ accessToken: "server-token", refreshToken: "server-refresh", userId: 7 });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: "/preview" } } });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, authorization: init.headers.get("Authorization") });
    return Response.json({ data: { origin: "backend" } });
  };
  try {
    assert.equal(getCurrentUserId(), 7);
    assert.equal(getAccessToken(), "server-token");
    assert.deepEqual(await apiRequest("/api/v1/posts/3"), { data: { origin: "backend" } });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/v1/posts/3"));
    assert.equal(calls[0].authorization, "Bearer server-token");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
    clearAuthSession();
  }
});

test("keeps the backend error code on failed API responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    message: "존재하지 않는 갤러리입니다.",
    errorCode: "GALLERY_NOT_FOUND",
  }), { status: 404, headers: { "Content-Type": "application/json" } });

  try {
    await assert.rejects(
      () => apiRequest("/api/v1/galleries/1/posts"),
      (error) => error instanceof ApiError
        && error.status === 404
        && error.errorCode === "GALLERY_NOT_FOUND",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("clears an expired session and keeps a visible message on an empty 401 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  setAuthSession({ accessToken: "expired", refreshToken: "expired", userId: 7 });

  try {
    await assert.rejects(
      () => apiRequest("/api/v1/users/profiles/7"),
      (error) => error instanceof ApiError
        && error.status === 401
        && error.message.length > 0,
    );
    assert.equal(getCurrentUserId(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not clear a newly logged-in account when an old request later returns 401", async () => {
  const originalFetch = globalThis.fetch;
  let resolveOldRequest;
  globalThis.fetch = () => new Promise((resolve) => { resolveOldRequest = resolve; });
  setAuthSession({ accessToken: "old-token", refreshToken: "old-refresh", userId: 7 });

  try {
    const oldRequest = apiRequest("/api/v1/project-contributions/inbox");
    setAuthSession({ accessToken: "new-token", refreshToken: "new-refresh", userId: 9 });
    resolveOldRequest(new Response(null, { status: 401 }));

    await assert.rejects(oldRequest, (error) => error instanceof ApiError && error.status === 401);
    assert.equal(getCurrentUserId(), 9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

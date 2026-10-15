import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  apiRequest,
  clearAuthSession,
  getAccessToken,
  getCurrentUserId,
  getRefreshToken,
  setAuthSession,
} from "./client.ts";

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

test("refreshes an expired access token and retries the request", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/refresh")) return Response.json({ data: {
      accessToken: "new-access", refreshToken: "new-refresh", tokenType: "Bearer",
    } });
    if (init.headers.get("Authorization") === "Bearer expired") return new Response(null, { status: 401 });
    return Response.json({ ok: true });
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  try {
    assert.deepEqual(await apiRequest("/api/v1/users/profiles/7"), { ok: true });
    assert.equal(calls.length, 3);
    assert.equal(new Headers(calls[1].init.headers).get("Authorization"), null);
    assert.deepEqual(JSON.parse(calls[1].init.body), { refreshToken: "valid-refresh" });
    assert.equal(calls[2].init.headers.get("Authorization"), "Bearer new-access");
    assert.equal(getAccessToken(), "new-access");
    assert.equal(getRefreshToken(), "new-refresh");
    assert.equal(getCurrentUserId(), 7);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deduplicates refresh when protected requests fail together", async () => {
  const originalFetch = globalThis.fetch;
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      return Response.json({ data: { accessToken: "renewed", refreshToken: "rotated", tokenType: "Bearer" } });
    }
    return init.headers.get("Authorization") === "Bearer expired"
      ? new Response(null, { status: 401 })
      : Response.json({ ok: true });
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  try {
    assert.deepEqual(await Promise.all([
      apiRequest("/api/v1/users/profiles/7"),
      apiRequest("/api/v1/project-contributions/inbox"),
    ]), [{ ok: true }, { ok: true }]);
    assert.equal(refreshes, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("clears a session only when its refresh token is rejected", async () => {
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

test("keeps the session when token refresh is temporarily unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(null, { status: url.endsWith("/auth/refresh") ? 503 : 401 });
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  try {
    await assert.rejects(() => apiRequest("/api/v1/users/profiles/7"));
    assert.equal(getCurrentUserId(), 7);
    assert.equal(getRefreshToken(), "valid-refresh");
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

test("does not restore a session when logout happens during refresh", async () => {
  const originalFetch = globalThis.fetch;
  let finishRefresh;
  let requests = 0;
  globalThis.fetch = (url) => {
    if (url.endsWith("/auth/refresh")) return new Promise((resolve) => { finishRefresh = resolve; });
    requests++;
    return Promise.resolve(new Response(null, { status: 401 }));
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  try {
    const pendingRequest = apiRequest("/api/v1/users/profiles/7");
    await new Promise((resolve) => setImmediate(resolve));
    clearAuthSession();
    finishRefresh(Response.json({ data: {
      accessToken: "new-access", refreshToken: "new-refresh", tokenType: "Bearer",
    } }));
    await assert.rejects(pendingRequest, (error) => error instanceof ApiError && error.status === 401);
    assert.equal(requests, 1);
    assert.equal(getCurrentUserId(), null);
    assert.equal(getAccessToken(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

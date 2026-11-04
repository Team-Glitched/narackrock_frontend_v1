import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  ApiError,
  SessionChangedError,
  apiRequest,
  clearAuthSession,
  getAccessToken,
  getCurrentUserId,
  getRefreshToken,
  setAuthSession,
} from "./client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  clearAuthSession();
});

const refreshed = (accessToken, refreshToken) =>
  Response.json({ success: true, message: "", data: { accessToken, refreshToken, tokenType: "Bearer" } });
const bearer = (init) => new Headers(init?.headers).get("Authorization");
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

test("keeps the backend error code on failed API responses", async () => {
  globalThis.fetch = async () =>
    Response.json({ message: "존재하지 않는 갤러리입니다.", errorCode: "GALLERY_NOT_FOUND" }, { status: 404 });

  await assert.rejects(
    () => apiRequest("/api/v1/galleries/1/posts"),
    (error) => error instanceof ApiError && error.status === 404 && error.errorCode === "GALLERY_NOT_FOUND",
  );
});

test("refreshes an expired access token, persists the rotation, and retries once", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/v1/auth/refresh")) return refreshed("new-access", "new-refresh");
    return bearer(init) === "Bearer expired" ? new Response(null, { status: 401 }) : Response.json({ ok: true });
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  assert.deepEqual(await apiRequest("/api/v1/users/profiles/7"), { ok: true });
  assert.equal(calls.length, 3);
  assert.equal(bearer(calls[1].init), null);
  assert.deepEqual(JSON.parse(calls[1].init.body), { refreshToken: "valid-refresh" });
  assert.equal(bearer(calls[2].init), "Bearer new-access");
  assert.equal(getAccessToken(), "new-access");
  assert.equal(getRefreshToken(), "new-refresh");
  assert.equal(getCurrentUserId(), 7);
});

test("concurrent 401 responses share one refresh", async () => {
  let refreshes = 0;
  let finishRefresh;
  globalThis.fetch = (url, init) => {
    if (url.endsWith("/api/v1/auth/refresh")) {
      refreshes++;
      return new Promise((resolve) => {
        finishRefresh = () => resolve(refreshed("renewed", "rotated"));
      });
    }
    return Promise.resolve(
      bearer(init) === "Bearer expired" ? new Response(null, { status: 401 }) : Response.json({ ok: true }),
    );
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  const pending = Promise.all([
    apiRequest("/api/v1/users/profiles/7"),
    apiRequest("/api/v1/project-contributions/inbox"),
  ]);
  await nextTick();
  finishRefresh();
  assert.deepEqual(await pending, [{ ok: true }, { ok: true }]);
  assert.equal(refreshes, 1);
});

test("a retried request that is still unauthorized is not refreshed again", async () => {
  let refreshes = 0;
  let protectedCalls = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/api/v1/auth/refresh")) {
      refreshes++;
      return refreshed("still-rejected", "rotated");
    }
    protectedCalls++;
    return new Response(null, { status: 401 });
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  await assert.rejects(() => apiRequest("/api/v1/users/profiles/7"), (error) => error.status === 401);
  assert.equal(refreshes, 1);
  assert.equal(protectedCalls, 2);
});

test("clears the session only when its refresh token is rejected", async () => {
  globalThis.fetch = async () => new Response(null, { status: 401 });
  setAuthSession({ accessToken: "expired", refreshToken: "expired", userId: 7 });

  await assert.rejects(
    () => apiRequest("/api/v1/users/profiles/7"),
    (error) => error instanceof ApiError && error.status === 401 && error.message.length > 0,
  );
  assert.equal(getCurrentUserId(), null);
});

test("keeps the session when token refresh is temporarily unavailable", async () => {
  globalThis.fetch = async (url) =>
    new Response(null, { status: url.endsWith("/api/v1/auth/refresh") ? 503 : 401 });
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  await assert.rejects(() => apiRequest("/api/v1/users/profiles/7"), (error) => error.status === 503);
  assert.equal(getCurrentUserId(), 7);
  assert.equal(getRefreshToken(), "valid-refresh");
});

test("an old account's late 401 neither refreshes nor clears the new account", async () => {
  let resolveOldRequest;
  let refreshes = 0;
  globalThis.fetch = (url) => {
    if (url.endsWith("/api/v1/auth/refresh")) refreshes++;
    return new Promise((resolve) => {
      resolveOldRequest = resolve;
    });
  };
  setAuthSession({ accessToken: "old-token", refreshToken: "old-refresh", userId: 7 });

  const oldRequest = apiRequest("/api/v1/project-contributions/inbox");
  setAuthSession({ accessToken: "new-token", refreshToken: "new-refresh", userId: 9 });
  resolveOldRequest(new Response(null, { status: 401 }));

  await assert.rejects(oldRequest, SessionChangedError);
  assert.equal(refreshes, 0);
  assert.equal(getCurrentUserId(), 9);
  assert.equal(getAccessToken(), "new-token");
});

test("an old account's late successful response is not delivered after logout", async () => {
  let resolveOldRequest;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      resolveOldRequest = resolve;
    });
  setAuthSession({ accessToken: "old-token", refreshToken: "old-refresh", userId: 7 });

  const oldRequest = apiRequest("/api/v1/users/me/bookmarks/posts");
  clearAuthSession();
  resolveOldRequest(Response.json({ data: ["private to user 7"] }));

  await assert.rejects(oldRequest, SessionChangedError);
});

test("logout during refresh does not restore the session or resend the request", async () => {
  let finishRefresh;
  let requests = 0;
  globalThis.fetch = (url) => {
    if (url.endsWith("/api/v1/auth/refresh"))
      return new Promise((resolve) => {
        finishRefresh = resolve;
      });
    requests++;
    return Promise.resolve(new Response(null, { status: 401 }));
  };
  setAuthSession({ accessToken: "expired", refreshToken: "valid-refresh", userId: 7 });

  const pendingRequest = apiRequest("/api/v1/users/profiles/7");
  await nextTick();
  clearAuthSession();
  finishRefresh(refreshed("new-access", "new-refresh"));

  await assert.rejects(pendingRequest, SessionChangedError);
  assert.equal(requests, 1);
  assert.equal(getCurrentUserId(), null);
  assert.equal(getAccessToken(), null);
});

test("other origins never receive the session or trigger a refresh", async () => {
  globalThis.window = { location: { origin: "http://backend.test" } };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, authorization: bearer(init) });
    return new Response(null, { status: url.startsWith("https://storage.example") ? 401 : 204 });
  };
  setAuthSession({ accessToken: "secret", refreshToken: "refresh", userId: 7 });

  await apiRequest("http://backend.test/api/v1/media/3/content", { method: "PUT", body: "a" });
  await assert.rejects(
    () => apiRequest("https://storage.example/upload/3", { method: "PUT", body: "a" }),
    (error) => error.status === 401,
  );
  assert.deepEqual(calls, [
    { url: "http://backend.test/api/v1/media/3/content", authorization: "Bearer secret" },
    { url: "https://storage.example/upload/3", authorization: null },
  ]);
  assert.equal(getCurrentUserId(), 7);
});

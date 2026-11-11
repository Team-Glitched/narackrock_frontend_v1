import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getMyShorts, getRecommendedShorts } from "./shorts.ts";
import { clearAuthSession, setAuthSession } from "./client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; clearAuthSession(); });

test("mine sends the server cursor and preserves server pagination metadata", async () => {
  setAuthSession({ userId: 7, accessToken: "test-access", refreshToken: "test-refresh" });
  const controller = new AbortController();
  let requested = "";
  let signal: AbortSignal | null | undefined;
  const page = { items: [], page: { nextCursor: 91, hasMore: true, size: 20 } };
  globalThis.fetch = async (input, init) => {
    requested = String(input);
    signal = init?.signal;
    return Response.json({ success: true, message: "", data: page });
  };
  assert.deepEqual(await getMyShorts({ cursor: 111, size: 20 }, controller.signal), page);
  const url = new URL(requested, "https://example.test");
  assert.equal(url.pathname, "/api/v1/shorts/mine");
  assert.equal(url.searchParams.get("cursor"), "111");
  assert.equal(url.searchParams.get("size"), "20");
  assert.equal(signal, controller.signal);
});

test("mine defaults to a bounded first page without a synthetic cursor", async () => {
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return Response.json({ success: true, message: "", data: { items: [], page: { nextCursor: null, hasMore: false, size: 20 } } });
  };
  await getMyShorts();
  const url = new URL(requested, "https://example.test");
  assert.equal(url.searchParams.get("size"), "20");
  assert.equal(url.searchParams.has("cursor"), false);
});

test("recommendations preserve backend reasons and send the opaque continuation cursor", async () => {
  const controller = new AbortController();
  const cursor = "87b0a34c-a571-4c3c-b770-60254f0fd133:10";
  const page = {
    items: [{ shortId: 12, title: "Song", albumImageUrl: null, author: { userId: 2, nickname: "Composer" }, reason: "SAVED_ARTIST" }],
    page: { nextCursor: null, hasMore: false, size: 10 },
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "https://example.test");
    assert.equal(url.pathname, "/api/v1/shorts/recommended");
    assert.equal(url.searchParams.get("cursor"), cursor);
    assert.equal(url.searchParams.get("size"), "10");
    assert.equal(init?.signal, controller.signal);
    return Response.json({ success: true, message: "", data: page });
  };
  assert.deepEqual(await getRecommendedShorts(cursor, controller.signal), page);
});

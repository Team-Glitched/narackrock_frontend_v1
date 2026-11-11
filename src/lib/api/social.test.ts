import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearAuthSession, setAuthSession } from "./client.ts";
import { getUnreadChatCount, markChatRead } from "./social.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; clearAuthSession(); });

test("reads the account's unread chat count and marks only the displayed conversation", async () => {
  setAuthSession({ userId: 1, accessToken: "test-access", refreshToken: "test-refresh" });
  const controller = new AbortController();
  const requests: Array<{ path: string; method: string; body?: BodyInit | null }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-access");
    assert.equal(init?.signal, controller.signal);
    requests.push({ path: String(input), method: init?.method ?? "GET", body: init?.body });
    return init?.method === "PATCH"
      ? new Response(null, { status: 204 })
      : Response.json({ success: true, data: { count: 3 } });
  };

  assert.deepEqual(await getUnreadChatCount(controller.signal), { count: 3 });
  await markChatRead(7, 42, controller.signal);
  assert.deepEqual(requests, [
    { path: "/api/v1/chats/unread-count", method: "GET", body: undefined },
    { path: "/api/v1/chats/7/read", method: "PATCH", body: '{"throughId":42}' },
  ]);
});

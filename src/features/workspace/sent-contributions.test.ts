import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getSentContributions } from "../../lib/api/composition.ts";
import { ApiError, clearAuthSession, setAuthSession } from "../../lib/api/client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAuthSession();
});

test("loads sent requests from the account endpoint across projects and forwards the cursor", async () => {
  setAuthSession({
    accessToken: "local-test-access",
    refreshToken: "local-test-refresh",
    userId: 7,
  });
  const calls: { url: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    return Response.json({
      success: true,
      data: {
        items: [
          {
            contributionId: calls.length === 1 ? 30 : 29,
            projectId: calls.length === 1 ? 41 : 99,
            projectTitle: "보낸 곡",
            approvalStatus: "REJECTED",
            description: "기타 추가",
            createdAt: "2026-11-08T12:00:00Z",
          },
        ],
        page: { nextCursor: calls.length === 1 ? 30 : null, hasMore: calls.length === 1, size: 20 },
      },
    });
  };
  const first = await getSentContributions();
  const next = await getSentContributions(first.page.nextCursor!);
  assert.equal(first.items[0].approvalStatus, "REJECTED");
  assert.equal(next.items[0].projectId, 99);
  assert.deepEqual(calls, [
    { url: "/api/v1/users/me/contributions?size=20", authorization: "Bearer local-test-access" },
    {
      url: "/api/v1/users/me/contributions?size=20&cursor=30",
      authorization: "Bearer local-test-access",
    },
  ]);
});

test("keeps an account-history fetch failure as an error instead of an empty list", async () => {
  globalThis.fetch = async () => Response.json({ message: "조회 실패" }, { status: 403 });
  await assert.rejects(
    () => getSentContributions(),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

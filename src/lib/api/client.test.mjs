import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, apiRequest } from "./client.ts";

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

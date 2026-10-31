import test from "node:test";
import assert from "node:assert/strict";
import { resolvePostTarget } from "./post-target.ts";
test("posting requires a community confirmed by the current gallery response", () => {
  assert.equal(resolvePostTarget({ status: "loading" }, 1), "loading");
  assert.equal(resolvePostTarget({ status: "error" }, 1), "error");
  assert.equal(resolvePostTarget({ status: "ready", galleries: [] }, 1), "missing");
  assert.equal(resolvePostTarget({ status: "ready", galleries: [{ galleryId: 2 }] }, 1), "missing");
  assert.equal(resolvePostTarget({ status: "ready", galleries: [{ galleryId: 2 }] }, 2), "ready");
});

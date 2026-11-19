import test from "node:test";
import assert from "node:assert/strict";
import { resolvePostTarget } from "./post-target.ts";
const joined = { loading: false, loadFailed: false, isJoined: () => true, isPending: () => false };
test("posting requires a community confirmed by the current gallery response", () => {
  assert.equal(resolvePostTarget({ status: "loading" }, 1, joined), "loading");
  assert.equal(resolvePostTarget({ status: "error" }, 1, joined), "error");
  assert.equal(resolvePostTarget({ status: "ready", galleries: [] }, 1, joined), "missing");
  assert.equal(
    resolvePostTarget({ status: "ready", galleries: [{ galleryId: 2 }] }, 1, joined),
    "missing",
  );
  assert.equal(
    resolvePostTarget({ status: "ready", galleries: [{ galleryId: 2 }] }, 2, joined),
    "ready",
  );
});

test("posting requires a confirmed membership of the selected community", () => {
  const galleries = { status: "ready", galleries: [{ galleryId: 2 }, { galleryId: 3 }] };
  const member = {
    loading: false,
    loadFailed: false,
    isJoined: (id) => id === 2,
    isPending: () => false,
  };
  assert.equal(resolvePostTarget(galleries, 2, member), "ready");
  assert.equal(resolvePostTarget(galleries, 3, member), "not_joined");
  assert.equal(resolvePostTarget(galleries, 2, { ...member, loading: true }), "loading");
  assert.equal(resolvePostTarget(galleries, 2, { ...member, loadFailed: true }), "error");
  assert.equal(resolvePostTarget(galleries, 2, { ...member, isPending: () => true }), "loading");
});

import assert from "node:assert/strict";
import test from "node:test";

import { completedExportShortId } from "./publish-navigation.ts";

test("returns the published short id after export completion", () => {
  assert.equal(completedExportShortId({ status: "COMPLETED", shortId: 73 }), 73);
});

test("does not navigate while the export is still processing", () => {
  assert.equal(completedExportShortId({ status: "PROCESSING", shortId: null }), null);
});

test("rejects a completed export without a published short", () => {
  assert.throws(
    () => completedExportShortId({ status: "COMPLETED", shortId: null }),
    /생성된 숏폼을 찾을 수 없습니다/,
  );
});

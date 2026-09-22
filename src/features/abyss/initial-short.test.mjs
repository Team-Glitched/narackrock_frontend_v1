import assert from "node:assert/strict";
import { test } from "node:test";
import { initialShortIndex } from "./initial-short.ts";

test("restores the short that opened the contribution session", () => {
  assert.equal(initialShortIndex([{ shortId: 3 }, { shortId: 8 }, { shortId: 13 }], 8), 1);
});

test("falls back to the first short when the target is no longer in the feed", () => {
  assert.equal(initialShortIndex([{ shortId: 3 }], 99), 0);
});

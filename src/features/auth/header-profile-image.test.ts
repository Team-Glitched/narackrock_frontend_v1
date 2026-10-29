import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/App.tsx", import.meta.url), "utf8");
const shared = readFileSync(new URL("../../components/app/shared.tsx", import.meta.url), "utf8");

test("renders the current user's saved profile image in the header", () => {
  assert.match(page, /getProfile\(currentUserId\)/);
  assert.match(page, /profileImageUrl=\{headerProfileImageUrl\}/);
  assert.match(shared, /profileImageUrl\?: string \| null/);
  assert.match(shared, /<Avatar src=\{profileImageUrl\} \/>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("src/app/App.tsx", "utf8");
const profileSource = readFileSync("src/features/profile/profile-screens.tsx", "utf8");

test("shows the privacy policy link only in the profile edit form", () => {
  assert.doesNotMatch(pageSource, /site-privacy-link/);
  assert.match(profileSource, /className="profile-privacy-link" href="\/privacy"/);
  assert.match(profileSource, /개인정보처리방침/);
});

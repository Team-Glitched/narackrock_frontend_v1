import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const authScreen = readFileSync(new URL("../screens/auth-screens.tsx", import.meta.url), "utf8");
const profileScreen = readFileSync(new URL("../profile/profile-screens.tsx", import.meta.url), "utf8");

test("uses one Google login screen and routes first-time users to profile setup", () => {
  assert.doesNotMatch(authScreen, /mode: "login" \| "signup"/);
  assert.doesNotMatch(authScreen, /auth-switch/);
  assert.match(authScreen, /result\.firstLogin/);
  assert.match(page, /PendingProfileSetup/);
  assert.doesNotMatch(page, /activeView === "signup"/);
  assert.doesNotMatch(profileScreen, /signupWithGoogle/);
});

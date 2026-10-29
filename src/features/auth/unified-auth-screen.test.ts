import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/App.tsx", import.meta.url), "utf8");
const authScreen = readFileSync(new URL("../screens/auth-screens.tsx", import.meta.url), "utf8");
const profileScreen = readFileSync(new URL("../profile/profile-screens.tsx", import.meta.url), "utf8");

test("uses the shared Google authentication flow for Figma login and signup views", () => {
  assert.doesNotMatch(authScreen, /mode: "login" \| "signup"/);
  assert.match(authScreen, /loginWithGoogle\(response\.credential\)/);
  assert.doesNotMatch(authScreen, /signupWithGoogle/);
  assert.match(authScreen, /result\.firstLogin/);
  assert.match(page, /PendingProfileSetup/);
  assert.doesNotMatch(page, /activeView === "signup"/);
  assert.doesNotMatch(profileScreen, /signupWithGoogle/);
});

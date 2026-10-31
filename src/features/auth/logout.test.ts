import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { logout } from "../../lib/api/auth.ts";
import {
  getAccessToken,
  getCurrentUserId,
  getRefreshToken,
  setAuthSession,
} from "../../lib/api/client.ts";

const profileScreen = readFileSync(
  new URL("../settings/settings-screen.tsx", import.meta.url),
  "utf8",
);

test("clears every local authentication value on logout", () => {
  setAuthSession({ accessToken: "access", refreshToken: "refresh", userId: 7 });

  logout();

  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
  assert.equal(getCurrentUserId(), null);
});

test("provides logout in account settings", () => {
  assert.match(profileScreen, />\s*로그아웃\s*<\/button>/);
  assert.match(profileScreen, /onClick=\{logout\}/);
});

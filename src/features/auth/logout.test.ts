import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { logout } from "../../lib/api/auth.ts";
import { getAccessToken, getCurrentUserId, getRefreshToken, setAuthSession } from "../../lib/api/client.ts";

const profileScreen = readFileSync(
  new URL("../profile/profile-screens.tsx", import.meta.url),
  "utf8",
);

test("clears every local authentication value on logout", () => {
  setAuthSession({ accessToken: "access", refreshToken: "refresh", userId: 7 });

  logout();

  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
  assert.equal(getCurrentUserId(), null);
});

test("provides logout from the user's profile", () => {
  assert.match(profileScreen, /className="profile-settings-menu"/);
  assert.match(profileScreen, />로그아웃<\/button>/);
  assert.match(profileScreen, /onClick=\{logout\}/);
});

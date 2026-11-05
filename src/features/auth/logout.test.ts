import assert from "node:assert/strict";
import test from "node:test";

import { logout } from "../../lib/api/auth.ts";
import {
  getAccessToken,
  getCurrentUserId,
  getRefreshToken,
  setAuthSession,
} from "../../lib/api/client.ts";


test("clears every local authentication value on logout", () => {
  setAuthSession({ accessToken: "access", refreshToken: "refresh", userId: 7 });

  logout();

  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
  assert.equal(getCurrentUserId(), null);
});


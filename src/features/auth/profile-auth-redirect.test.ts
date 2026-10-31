import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pageRoutes } from "../navigation/route-config.ts";
const guard = readFileSync(new URL("./require-auth.tsx", import.meta.url), "utf8");
test("redirects protected profile screens to login after the session expires", () => {
  const protectedIds = pageRoutes
    .filter((route) => "requiresAuth" in route && route.requiresAuth)
    .map((route) => route.id);
  assert.ok(protectedIds.includes("profile") && protectedIds.includes("editProfile"));
  assert.ok(!protectedIds.includes("user"));
  assert.match(guard, /currentUserId === null/);
  assert.match(guard, /<Navigate\s+to="\/login"/);
  assert.match(guard, /returnTo: location.pathname \+ location.search/);
});

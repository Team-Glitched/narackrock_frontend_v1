import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");

test("redirects protected profile screens to login after the session expires", () => {
  assert.match(page, /const activeView: View = currentUserId === null/);
  for (const view of ["profile", "bookmarks", "edit", "mutual", "recommendations", "followers", "following", "chat", "savedPosts", "likedPosts", "notifications"]) {
    assert.match(page, new RegExp(`view === "${view}"`));
  }
  assert.match(page, /activeView === "login"/);
});

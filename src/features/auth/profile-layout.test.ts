import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileScreen = readFileSync(
  new URL("../profile/profile-screens.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

test("keeps the profile image overlay centered inside the avatar", () => {
  assert.match(profileScreen, /className="edit-avatar-visual"/);
  assert.match(profileScreen, /className="edit-avatar-overlay"/);
  assert.match(globalStyles, /\.edit-avatar-visual\{[^}]*position:relative[^}]*width:140px[^}]*height:140px/);
  assert.match(globalStyles, /\.edit-avatar-overlay\{[^}]*position:absolute[^}]*inset:2px[^}]*display:grid[^}]*place-items:center/);
});

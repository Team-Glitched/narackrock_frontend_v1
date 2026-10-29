import assert from "node:assert/strict";
import test from "node:test";
import { profileStyles } from "../../styles/profile.styles.ts";

const tokens = (value: string) => new Set(value.split(/\s+/));

test("keeps the profile image overlay centered inside the avatar", () => {
  const visual = tokens(profileStyles.editAvatarVisual);
  const overlay = tokens(profileStyles.editAvatarOverlay);
  assert.ok(visual.has("edit-avatar-visual") && visual.has("relative"));
  assert.ok(visual.has("h-35") && visual.has("w-35"));
  assert.ok(overlay.has("absolute") && overlay.has("inset-[2px]"));
  assert.ok(overlay.has("grid") && overlay.has("place-items-center"));
});

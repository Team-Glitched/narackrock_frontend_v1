import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_NAME_MIN_LENGTH,
  CONTRIBUTION_COMMENT_MAX_LENGTH,
  INSTRUMENT_MAX_LENGTH,
  MODERATION_REASON_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  REPORT_DESCRIPTION_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
  SOURCE_DESCRIPTION_MAX_LENGTH,
  SOURCE_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "./content-limits.ts";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("all 17 content limit constants match backend ContentLimits validation", () => {
  assert.equal(NICKNAME_MAX_LENGTH, 20);
  assert.equal(PROFILE_BIO_MAX_LENGTH, 200);
  assert.equal(INSTRUMENT_MAX_LENGTH, 50);
  assert.equal(COMMUNITY_NAME_MIN_LENGTH, 2);
  assert.equal(COMMUNITY_NAME_MAX_LENGTH, 20);
  assert.equal(COMMUNITY_DESCRIPTION_MAX_LENGTH, 500);
  assert.equal(SONG_TITLE_MAX_LENGTH, 40);
  assert.equal(SOURCE_TITLE_MAX_LENGTH, 40);
  assert.equal(SOURCE_DESCRIPTION_MAX_LENGTH, 500);
  assert.equal(POST_TITLE_MAX_LENGTH, 40);
  assert.equal(POST_CONTENT_MAX_LENGTH, 5000);
  assert.equal(COMMENT_MAX_LENGTH, 3000);
  assert.equal(CHAT_MESSAGE_MAX_LENGTH, 2000);
  assert.equal(CONTRIBUTION_COMMENT_MAX_LENGTH, 120);
  assert.equal(MODERATION_REASON_MAX_LENGTH, 500);
  assert.equal(REPORT_DESCRIPTION_MAX_LENGTH, 1000);
  assert.equal(SEARCH_QUERY_MAX_LENGTH, 100);
});

test("codePointLength counts Korean Hangul and emoji surrogate pairs as 1 character each", () => {
  assert.equal(codePointLength("새벽 피아노 🎹"), 8);
  assert.equal("새벽 피아노 🎹".length, 9);
  assert.equal(codePointLength(""), 0);
});

test("clampCodePoints truncates by code points without splitting surrogate pairs across limits", () => {
  const sample = "🎵".repeat(10);
  assert.equal(sample.length, 20);
  const clamped = clampCodePoints(sample, 5);
  assert.equal(clamped, "🎵".repeat(5));
  assert.equal(codePointLength(clamped), 5);
  assert.equal(clampCodePoints("가나다", 0), "");
  assert.equal(clampCodePoints("짧은제목", SONG_TITLE_MAX_LENGTH), "짧은제목");

  for (const limit of [
    NICKNAME_MAX_LENGTH,
    SONG_TITLE_MAX_LENGTH,
    PROFILE_BIO_MAX_LENGTH,
    COMMUNITY_DESCRIPTION_MAX_LENGTH,
    COMMENT_MAX_LENGTH,
    POST_CONTENT_MAX_LENGTH,
  ]) {
    const oversized = "🎹".repeat(limit + 3);
    const truncated = clampCodePoints(oversized, limit);
    assert.equal(codePointLength(truncated), limit);
    assert.equal(truncated, "🎹".repeat(limit));
  }
});

test("profile, community, post, and metadata screens do not retain stale hardcoded limits", () => {
  const checkedFiles = [
    "src/features/profile/profile-screens.tsx",
    "native/screens/auth/onboarding.tsx",
    "native/screens/profile/edit-profile.tsx",
    "src/features/composition/project-metadata-editor.tsx",
    "src/features/community/create-content.tsx",
    "native/screens/post/post-create.tsx",
    "native/screens/social/create-community.tsx",
    "src/features/admin/admin-screens.tsx",
    "native/screens/admin/community.tsx",
  ];
  const forbiddenPatterns = [
    /DESCRIPTION_LIMIT\s*=\s*1000/,
    /maxLength=\{30\}/,
    /maxLength:\s*30/,
    /maxLength=\{100\}/,
    /maxLength=\{kind === "source" \? undefined : 100\}/,
  ];
  for (const relPath of checkedFiles) {
    const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${relPath} still matches stale pattern ${pattern}`,
      );
    }
  }
});

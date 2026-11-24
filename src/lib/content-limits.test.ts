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
  hasVisibleText,
  sanitizeMultiline,
  sanitizeSingleLine,
  stripInvisibleChars,
} from "./content-limits.ts";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("all 17 content limit constants match backend ContentLimits validation", () => {
  assert.equal(NICKNAME_MAX_LENGTH, 20);
  assert.equal(PROFILE_BIO_MAX_LENGTH, 200);
  assert.equal(INSTRUMENT_MAX_LENGTH, 250);
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

test("invisible character sanitizers strip fillers, bidi, and control chars while keeping Hangul, ZWJ emojis, and newlines", () => {
  assert.equal(sanitizeSingleLine("\u3164\u115F\u1160\uFFA0\u2800"), "");
  assert.equal(sanitizeSingleLine("\u200B\u200C\u200E\u200F\u2060\uFEFF\u00AD"), "");
  assert.equal(sanitizeSingleLine("\u202A\u202E\u2066\u2069\u0000\u0007\u007F\u0085"), "");
  assert.equal(sanitizeSingleLine("\u00A0\u3000"), "");
  assert.equal(sanitizeSingleLine("\u200D\uFE0F"), "");

  assert.equal(hasVisibleText("\u3164\u2800\u200B"), false);
  assert.equal(hasVisibleText("   \n\t "), false);
  assert.equal(hasVisibleText("가"), true);

  assert.equal(sanitizeSingleLine("안\u3164녕\u00A0하\n세요\u200B"), "안녕 하 세요");
  assert.equal(sanitizeMultiline("\u200B첫\u3000줄\r\n둘\u3164째\u202E줄\n\u2800"), "첫 줄\n둘째줄");

  const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
  const rainbowFlag = "\u{1F3F3}\uFE0F\u200D\u{1F308}";
  const heartOnFire = "\u2764\uFE0F\u200D\u{1F525}";
  const validText = `안녕하세요 ${family} ${rainbowFlag} ${heartOnFire}`;
  assert.equal(sanitizeSingleLine(validText), validText);

  assert.equal(clampCodePoints("가\u3164나\u200B다", 10), "가나다");

  // Large 100k-character paste does not trigger RangeError from spread call stack overflow
  const huge = `${"가\u200B".repeat(50_000)}`;
  const stripped = stripInvisibleChars(huge);
  assert.equal(codePointLength(stripped), 50_000);
});

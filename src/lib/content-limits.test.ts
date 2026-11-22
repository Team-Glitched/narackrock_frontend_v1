import assert from "node:assert/strict";
import test from "node:test";
import {
  SONG_TITLE_MAX_LENGTH,
  SOURCE_DESCRIPTION_MAX_LENGTH,
  SOURCE_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "./content-limits.ts";

test("content limit constants match backend validation", () => {
  assert.equal(SONG_TITLE_MAX_LENGTH, 40);
  assert.equal(SOURCE_TITLE_MAX_LENGTH, 40);
  assert.equal(SOURCE_DESCRIPTION_MAX_LENGTH, 500);
});

test("codePointLength counts Korean Hangul and emoji surrogate pairs as 1 character each", () => {
  assert.equal(codePointLength("새벽 피아노 🎹"), 8);
  assert.equal("새벽 피아노 🎹".length, 9);
  assert.equal(codePointLength(""), 0);
});

test("clampCodePoints truncates by code points without splitting surrogate pairs", () => {
  const sample = "🎵".repeat(10);
  assert.equal(sample.length, 20);
  const clamped = clampCodePoints(sample, 5);
  assert.equal(clamped, "🎵".repeat(5));
  assert.equal(codePointLength(clamped), 5);
  assert.equal(clampCodePoints("가나다", 0), "");
  assert.equal(clampCodePoints("짧은제목", SONG_TITLE_MAX_LENGTH), "짧은제목");
});

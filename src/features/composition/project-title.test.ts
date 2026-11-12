import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_TITLE_SUGGESTIONS,
  chooseProjectTitle,
  projectTitleHistoryKey,
  withRecentProjectTitle,
} from "./project-title.ts";

test("the title pool contains at least 2,000 distinct titles that fit the input", () => {
  assert.ok(PROJECT_TITLE_SUGGESTIONS.length >= 2_000);
  assert.equal(new Set(PROJECT_TITLE_SUGGESTIONS).size, PROJECT_TITLE_SUGGESTIONS.length);
  assert.ok(PROJECT_TITLE_SUGGESTIONS.includes("누구의 삶인들 향기롭지 않으랴"));
  assert.ok(PROJECT_TITLE_SUGGESTIONS.every((title) => title === title.trim() && title.length > 0 && title.length <= 100));
});

test("each available title can be selected and recent ones are excluded", () => {
  const recent = PROJECT_TITLE_SUGGESTIONS.slice(0, 20);
  const available = PROJECT_TITLE_SUGGESTIONS.slice(20);
  assert.equal(chooseProjectTitle(recent, () => 0), available[0]);
  assert.equal(chooseProjectTitle(recent, () => 0.5), available[Math.floor(available.length / 2)]);
  assert.equal(chooseProjectTitle(recent, () => 0.999999), available.at(-1));
});

test("recent history stays bounded and revisiting a title moves it to the front", () => {
  const recent = PROJECT_TITLE_SUGGESTIONS.slice(0, 20);
  const moved = withRecentProjectTitle(recent, recent[4]);
  assert.deepEqual(moved, [recent[4], ...recent.filter((title) => title !== recent[4])]);
  const next = PROJECT_TITLE_SUGGESTIONS[20];
  assert.deepEqual(withRecentProjectTitle(recent, next), [next, ...recent.slice(0, 19)]);
  assert.equal(recent.length, 20);
});

test("title history belongs to one account and API origin", () => {
  const origin = "https://api.example.test";
  assert.notEqual(projectTitleHistoryKey(origin, 1), projectTitleHistoryKey(origin, 2));
  assert.notEqual(projectTitleHistoryKey(origin, 1), projectTitleHistoryKey(origin, null));
  assert.notEqual(projectTitleHistoryKey(origin, 1), projectTitleHistoryKey("http://localhost:8080", 1));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  isOperatorAdminVisible,
  mergeManagerSearchPage,
  prioritizeExactNickname,
} from "./admin-search.ts";

test("prioritizes exact nickname matches ahead of instrument/bio matches", () => {
  const items = [
    { userId: 1, nickname: "드러머A", primaryInstrument: "기타" },
    { userId: 2, nickname: "guitar", primaryInstrument: "베이스" },
    { userId: 3, nickname: "기타", primaryInstrument: "보컬" },
    { userId: 4, nickname: "기타리스트", primaryInstrument: "피아노" },
  ];
  assert.deepEqual(
    prioritizeExactNickname(items, "기타").map((item) => item.userId),
    [3, 1, 2, 4],
  );
  assert.deepEqual(
    prioritizeExactNickname(items, "GUITAR").map((item) => item.userId),
    [2, 1, 3, 4],
  );
});

test("merges paged search results without duplicates and promotes newly loaded exact match", () => {
  const page0 = [
    {
      userId: 10,
      nickname: "피아노초보",
      primaryInstrument: "피아노",
      profileImageUrl: null,
    },
  ];
  const page1 = [
    {
      userId: 10,
      nickname: "피아노초보",
      primaryInstrument: "피아노",
      profileImageUrl: null,
    },
    {
      userId: 11,
      nickname: "피아노",
      primaryInstrument: "보컬",
      profileImageUrl: null,
    },
  ];
  const merged = mergeManagerSearchPage(page0, page1, "피아노");
  assert.deepEqual(
    merged.map((u) => u.userId),
    [11, 10],
  );
});

test("hides operator admin row when refetch errors even if stale data was true", () => {
  assert.equal(isOperatorAdminVisible({ operatorAdmin: true }, false), true);
  assert.equal(isOperatorAdminVisible({ operatorAdmin: true }, true), false);
  assert.equal(isOperatorAdminVisible(undefined, false), false);
});

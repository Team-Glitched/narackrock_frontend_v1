import assert from "node:assert/strict";
import test from "node:test";
import type { ShortItemDto } from "../../lib/api/contracts.ts";
import { appendUniqueSongs, songsForTab } from "./my-songs.ts";

function song(shortId: number, ownerId: number): ShortItemDto {
  return { shortId, projectId: null, title: `song ${shortId}`, mediaUrl: null, albumImageUrl: null,
    completionStatus: "COMPLETED", viewCount: 0, likeCount: 0, dislikeCount: 0, commentCount: 0,
    contributionCount: 0, isLiked: false, isDisliked: false, isBookmarked: false,
    hasPendingContribution: false, hasApprovedContribution: false,
    author: { userId: ownerId, nickname: "owner", profileImageUrl: null }, participants: [], createdAt: "2026-01-01" };
}

test("a filtered empty first page does not discard later participated songs", () => {
  const first = Array.from({ length: 20 }, (_, index) => song(index + 1, 7));
  assert.equal(songsForTab(first, 7, "participated").length, 0);
  const combined = appendUniqueSongs(first, [song(21, 9), song(22, 7), song(23, 9)]);
  assert.deepEqual(songsForTab(combined, 7, "participated").map((item) => item.shortId), [21, 23]);
  assert.deepEqual(songsForTab(combined, 7, "authored").map((item) => item.shortId), [...first.map((item) => item.shortId), 22]);
  assert.equal(first.length, 20);
});

test("cursor overlap keeps first-seen order and removes duplicate short IDs", () => {
  const first = [song(3, 7), song(2, 9)];
  const combined = appendUniqueSongs(first, [song(2, 9), song(1, 9), song(1, 9)]);
  assert.deepEqual(combined.map((item) => item.shortId), [3, 2, 1]);
  assert.equal(combined[1], first[1]);
});

test("the same accumulated pages classify against the current viewer", () => {
  const items = [song(1, 7), song(2, 9)];
  assert.deepEqual(songsForTab(items, 7, "authored").map((item) => item.shortId), [1]);
  assert.deepEqual(songsForTab(items, 9, "authored").map((item) => item.shortId), [2]);
});

test("both authored and participated tabs include in-progress songs so all published works can be featured", () => {
  const inProgressOwned = { ...song(10, 7), completionStatus: "IN_PROGRESS" as const };
  const inProgressJoined = { ...song(11, 9), completionStatus: "IN_PROGRESS" as const };
  assert.deepEqual(
    songsForTab([inProgressOwned, inProgressJoined], 7, "authored").map((item) => item.shortId),
    [10],
  );
  assert.deepEqual(
    songsForTab([inProgressOwned, inProgressJoined], 7, "participated").map((item) => item.shortId),
    [11],
  );
});

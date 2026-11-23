import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FEATURED_MUSIC,
  canPinMoreFeatured,
  toggleFeaturedList,
  type PinnedSongEntry,
} from "./featured-music-state.ts";

function entry(shortId: number, displayOrder: number): PinnedSongEntry {
  return {
    shortId,
    title: `song ${shortId}`,
    albumImageUrl: null,
    mediaUrl: null,
    displayOrder,
  };
}

test("canPinMoreFeatured allows up to 5 featured songs and allows existing pinned songs", () => {
  assert.equal(MAX_FEATURED_MUSIC, 5);
  const four = [entry(1, 0), entry(2, 1), entry(3, 2), entry(4, 3)];
  assert.equal(canPinMoreFeatured(four, 5), true);

  const five = [...four, entry(5, 4)];
  assert.equal(canPinMoreFeatured(five, 6), false);
  assert.equal(canPinMoreFeatured(five, 3), true);
});

test("toggleFeaturedList pins with monotonic displayOrder and unpins only the target song", () => {
  const initial = [entry(10, 0), entry(20, 2)];
  const added = toggleFeaturedList(
    initial,
    { shortId: 30, title: "new song", albumImageUrl: null },
    false,
  );
  assert.deepEqual(
    added.map((item) => [item.shortId, item.displayOrder]),
    [
      [10, 0],
      [20, 2],
      [30, 3],
    ],
  );

  const removed = toggleFeaturedList(added, { shortId: 20, title: "song 20", albumImageUrl: null }, true);
  assert.deepEqual(
    removed.map((item) => item.shortId),
    [10, 30],
  );
});

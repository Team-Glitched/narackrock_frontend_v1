import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beatMarksForDuration,
  createInitialSegments,
  deleteSegmentAt,
  duplicateSegmentAt,
  moveSegmentOrder,
  moveSegmentWindow,
  resizeSegmentEnd,
  resizeSegmentStart,
  selectionFromSegments,
  splitSegmentAt,
  splicedTimelinePosition,
  totalSegmentsMs,
} from "./audio-splice.ts";

test("splits, deletes, duplicates, and reorders segments safely", () => {
  const initial = createInitialSegments(10_000);
  assert.deepEqual(initial, [{ id: "seg-1", startMs: 0, endMs: 10_000 }]);

  const split = splitSegmentAt(initial, 4_000, "seg-2", 0);
  assert.ok(split);
  assert.equal(split.selectedIndex, 1);
  assert.deepEqual(split.segments, [
    { id: "seg-1", startMs: 0, endMs: 4_000 },
    { id: "seg-2", startMs: 4_000, endMs: 10_000 },
  ]);

  // Refuses splitting too close to an edge (< minAudioClipMs).
  assert.equal(splitSegmentAt(split.segments, 4_040, "seg-3", 1), null);

  const dup = duplicateSegmentAt(split.segments, 0, "seg-3");
  assert.ok(dup);
  assert.equal(dup.segments.length, 3);
  assert.equal(totalSegmentsMs(dup.segments), 14_000);

  const moved = moveSegmentOrder(dup.segments, 2, -1);
  assert.ok(moved);
  assert.equal(moved.segments[1].id, "seg-2");
  assert.equal(moved.selectedIndex, 1);

  const deleted = deleteSegmentAt(moved.segments, 0);
  assert.ok(deleted);
  assert.equal(deleted.segments.length, 2);

  // Refuses deleting the last remaining segment.
  assert.equal(deleteSegmentAt([deleted.segments[0]], 0), null);
});

test("enforces combined 60s limit when duplicating or resizing segments", () => {
  const segs = [
    { id: "seg-1", startMs: 0, endMs: 40_000 },
    { id: "seg-2", startMs: 40_000, endMs: 70_000 },
  ];
  // Wait: if second starts with 40..60 (20s), combined is 60s.
  const atLimit = [
    { id: "seg-1", startMs: 0, endMs: 40_000 },
    { id: "seg-2", startMs: 40_000, endMs: 60_000 },
  ];
  assert.equal(duplicateSegmentAt(atLimit, 1, "seg-3"), null);

  const expandedEnd = resizeSegmentEnd(atLimit, 1, 70_000, 90_000);
  assert.equal(expandedEnd[1].endMs, 60_000);

  const expandedStart = resizeSegmentStart(atLimit, 1, 30_000, 90_000);
  assert.equal(expandedStart[1].startMs, 40_000);

  const shifted = moveSegmentWindow(segs, 1, 5_000, 80_000);
  assert.deepEqual(shifted[1], { id: "seg-2", startMs: 45_000, endMs: 75_000 });
});

test("serializes single vs multi-segment selection properly", () => {
  assert.deepEqual(selectionFromSegments([{ startMs: 500, endMs: 3500 }]), {
    startMs: 500,
    endMs: 3500,
  });
  assert.deepEqual(
    selectionFromSegments([
      { startMs: 500, endMs: 2000 },
      { startMs: 4000, endMs: 7000 },
    ]),
    {
      startMs: 500,
      endMs: 7000,
      segments: [
        { startMs: 500, endMs: 2000 },
        { startMs: 4000, endMs: 7000 },
      ],
    },
  );
});

test("computes musical beat marks for 4/4, 3/4, and 6/8 time signatures", () => {
  // 120 BPM in 4/4 -> beat = 500ms, bar = 2000ms
  const fourFour = beatMarksForDuration(4_000, 120, { numerator: 4, denominator: 4 });
  assert.equal(fourFour.beatMs, 500);
  assert.equal(fourFour.barMs, 2_000);
  assert.equal(fourFour.totalBars, 2);
  assert.deepEqual(
    fourFour.marks.filter((m) => m.isBar).map((m) => ({ bar: m.bar, ms: m.ms, label: m.label })),
    [
      { bar: 1, ms: 0, label: "1" },
      { bar: 2, ms: 2000, label: "2" },
      { bar: 3, ms: 4000, label: "3" },
    ],
  );

  // 90 BPM in 3/4 -> beat = 666.67ms, bar = 2000ms
  const threeFour = beatMarksForDuration(4_000, 90, { numerator: 3, denominator: 4 });
  assert.equal(Math.round(threeFour.barMs), 2_000);
  assert.equal(threeFour.marks.filter((m) => m.isBar).length, 3);

  // 120 BPM in 6/8 -> beat = 250ms, bar = 1500ms
  const sixEight = beatMarksForDuration(3_000, 120, { numerator: 6, denominator: 8 });
  assert.equal(sixEight.beatMs, 250);
  assert.equal(sixEight.barMs, 1500);
  assert.equal(sixEight.totalBars, 2);
});

test("maps elapsed spliced playback time to active source segment and ms", () => {
  const segs = [
    { startMs: 1_000, endMs: 3_000 },
    { startMs: 6_000, endMs: 8_000 },
  ];
  assert.deepEqual(splicedTimelinePosition(segs, 500), { segmentIndex: 0, sourceMs: 1_500 });
  assert.deepEqual(splicedTimelinePosition(segs, 2_500), { segmentIndex: 1, sourceMs: 6_500 });
});

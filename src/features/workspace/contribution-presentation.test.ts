import assert from "node:assert/strict";
import test from "node:test";
import { canReviewRequest, contributionTrackIds, requestAge } from "./contribution-presentation.ts";

const now = Date.parse("2026-11-08T13:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

test("request times advance from just now through minutes, hours and days", () => {
  for (const [seconds, label] of [
    [0, "방금 전"],
    [59, "방금 전"],
    [60, "1분 전"],
    [3540, "59분 전"],
    [3600, "1시간 전"],
    [82800, "23시간 전"],
    [86400, "1일 전"],
    [259200, "3일 전"],
  ] as const) {
    assert.equal(requestAge(ago(seconds), now), label);
  }
  assert.equal(requestAge(ago(60), now + 3600000), "1시간 전");
});

test("invalid timestamps do not crash the request and future timestamps do not show negative time", () => {
  assert.equal(requestAge("invalid", now), "");
  assert.equal(requestAge("", now), "");
  assert.equal(requestAge(ago(-300), now), "방금 전");
});

test("only a reviewer can accept or reject another person's pending request", () => {
  const owner = { userId: 7, canReviewContribution: true };
  assert.equal(canReviewRequest({ userId: 8, approvalStatus: "PENDING" }, owner), true);
  assert.equal(canReviewRequest({ userId: 7, approvalStatus: "PENDING" }, owner), false);
  assert.equal(canReviewRequest({ userId: 8, approvalStatus: "APPROVED" }, owner), false);
  assert.equal(canReviewRequest({ userId: 8, approvalStatus: "REJECTED" }, owner), false);
  assert.equal(
    canReviewRequest(
      { userId: 8, approvalStatus: "PENDING" },
      { userId: 7, canReviewContribution: false },
    ),
    false,
  );
  assert.equal(canReviewRequest({ userId: 8, approvalStatus: "PENDING" }, undefined), false);
});

test("highlights only present tracks added by this request, including the parent of an added clip", () => {
  const tracks = [
    { trackId: 1, clips: [{ clipId: 11 }] },
    { trackId: 2, clips: [{ clipId: 22 }] },
    { trackId: 3, clips: [] },
  ];
  assert.deepEqual(
    [
      ...contributionTrackIds(
        [
          { changeType: "ADD", targetType: "TRACK", targetId: 2 },
          { changeType: "ADD", targetType: "CLIP", targetId: 11 },
          { changeType: "UPDATE", targetType: "TRACK", targetId: 3 },
          { changeType: "ADD", targetType: "TRACK", targetId: 99 },
        ],
        tracks,
      ),
    ],
    [1, 2],
  );
  assert.equal(contributionTrackIds([], tracks).size, 0);
  assert.equal(
    contributionTrackIds([{ changeType: "ADD", targetType: "CLIP", targetId: 99 }], tracks).size,
    0,
  );
});

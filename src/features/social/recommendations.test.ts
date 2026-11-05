import assert from "node:assert/strict";
import test from "node:test";
import type { RecommendedPerson } from "../../lib/api/social.ts";
import { loadRecommendationPrefix, mergeRecommendedPeople, recommendationFollowState, recommendationsHaveMore, RecommendationRequests, type RecommendationPage } from "./recommendations.ts";

const person = (userId: number, isFollowing = false): RecommendedPerson => ({ userId, nickname: `user${userId}`, profileImageUrl: null, primaryInstrument: null, recommendType: "POPULAR_CREATOR", explanation: null, isFollowing });
const page = (ids: number[], totalCount = 45): RecommendationPage => ({ totalCount, recommendedUsers: ids.map((id) => person(id)) });

test("successful local results override server following and outgoing targets (not request IDs)", () => {
  const outgoing = [{ id: 99, requesterId: 1, targetId: 2 }];
  assert.equal(recommendationFollowState(person(2), outgoing, {}), "PENDING");
  assert.equal(recommendationFollowState(person(99), outgoing, {}), null);
  assert.equal(recommendationFollowState(person(2, true), outgoing, {}), "FOLLOWING");
  assert.equal(recommendationFollowState(person(2, true), outgoing, { 2: null }), null);
  assert.equal(recommendationFollowState(person(2), [], { 2: "PENDING" }), "PENDING");
});

test("offset mutation refresh replaces all successful pages and fills shifted boundaries", async () => {
  const before = [page([1, 2]), page([3, 4]), page([5, 6])];
  const calls: number[] = [];
  const after = await loadRecommendationPrefix(before.length - 1, async (index, size) => {
    assert.equal(size, 20);
    calls.push(index);
    return [page([2, 3]), page([4, 5]), page([6, 7])][index];
  });
  assert.deepEqual(calls, [0, 1, 2]);
  assert.deepEqual(mergeRecommendedPeople(after).map((row) => row.userId), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(mergeRecommendedPeople(before).map((row) => row.userId), [1, 2, 3, 4, 5, 6]);
});

test("prefix failure exposes no partially refreshed list and keeps the old prefix available", async () => {
  const existing = [page([1, 2]), page([3, 4])];
  let installed = existing;
  await assert.rejects(async () => {
    installed = await loadRecommendationPrefix(1, async (index) => {
      if (index === 1) throw new Error("offline");
      return page([2, 3]);
    });
  }, /offline/);
  assert.equal(installed, existing);
});

test("dedupe preserves first-seen order and pagination uses total count and successful page", () => {
  assert.deepEqual(mergeRecommendedPeople([page([3, 2]), page([2, 4])]).map((row) => row.userId), [3, 2, 4]);
  assert.equal(recommendationsHaveMore(0, 45), true);
  assert.equal(recommendationsHaveMore(1, 45), true);
  assert.equal(recommendationsHaveMore(2, 45), false);
  assert.equal(recommendationsHaveMore(0, 20), false);
});

test("account scope teardown invalidates in-flight results even after another scope begins", async () => {
  const oldScope = new RecommendationRequests();
  const oldResultCurrent = oldScope.capture();
  const installOld = Promise.resolve().then(() => oldResultCurrent());
  oldScope.invalidate();
  const nextScope = new RecommendationRequests();
  assert.equal(await installOld, false);
  assert.equal(nextScope.capture()(), true);
  // StrictMode replays effects on the same instance: old requests must remain invalid.
  const replayResultCurrent = oldScope.capture();
  assert.equal(oldResultCurrent(), false);
  assert.equal(replayResultCurrent(), true);
  oldScope.invalidate();
  assert.equal(replayResultCurrent(), false);
});

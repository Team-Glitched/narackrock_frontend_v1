import assert from "node:assert/strict";
import test from "node:test";
import type { RecommendedPerson } from "../../lib/api/social.ts";
import { mergeRecommendedPeople, recommendationFollowState, recommendationsHaveMore, type RecommendationPage } from "./recommendations.ts";

const person = (userId: number, isFollowing = false): RecommendedPerson => ({ userId, nickname: `user${userId}`, profileImageUrl: null, primaryInstrument: null, recommendType: "POPULAR_CREATOR", explanation: null, isFollowing });
const page = (ids: number[], totalCount = 45): RecommendationPage => ({ totalCount, recommendedUsers: ids.map((id) => person(id)) });

test("server following wins over outgoing requests, matched by target (not request) IDs", () => {
  const outgoing = [{ id: 99, requesterId: 1, targetId: 2 }];
  assert.equal(recommendationFollowState(person(2), outgoing), "PENDING");
  assert.equal(recommendationFollowState(person(99), outgoing), null);
  assert.equal(recommendationFollowState(person(2, true), outgoing), "FOLLOWING");
  assert.equal(recommendationFollowState(person(2), []), null);
});

test("dedupe preserves first-seen order and pagination uses total count and successful page", () => {
  assert.deepEqual(mergeRecommendedPeople([page([3, 2]), page([2, 4])]).map((row) => row.userId), [3, 2, 4]);
  assert.deepEqual(mergeRecommendedPeople([page([2, 3]), page([4, 5]), page([6, 7])]).map((row) => row.userId), [2, 3, 4, 5, 6, 7]);
  assert.equal(recommendationsHaveMore(0, 45), true);
  assert.equal(recommendationsHaveMore(1, 45), true);
  assert.equal(recommendationsHaveMore(2, 45), false);
  assert.equal(recommendationsHaveMore(0, 20), false);
});

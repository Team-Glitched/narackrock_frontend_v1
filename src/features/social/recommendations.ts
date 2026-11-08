import type { OutgoingRequest, RecommendedPerson } from "../../lib/api/social.ts";

export type FollowState = "FOLLOWING" | "PENDING" | null;
export type RecommendationPage = { totalCount: number; recommendedUsers: RecommendedPerson[] };
export const RECOMMENDATION_PAGE_SIZE = 20;

export function recommendationFollowState(person: RecommendedPerson, outgoing: readonly OutgoingRequest[]): FollowState {
  if (person.isFollowing) return "FOLLOWING";
  return outgoing.some((request) => request.targetId === person.userId) ? "PENDING" : null;
}

export function mergeRecommendedPeople(pages: readonly RecommendationPage[]): RecommendedPerson[] {
  const found = new Set<number>();
  return pages.flatMap((page) => page.recommendedUsers.filter((person) => {
    if (found.has(person.userId)) return false;
    found.add(person.userId);
    return true;
  }));
}

export function recommendationsHaveMore(lastPage: number, totalCount: number): boolean {
  return (lastPage + 1) * RECOMMENDATION_PAGE_SIZE < totalCount;
}

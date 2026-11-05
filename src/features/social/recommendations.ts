import type { OutgoingRequest, RecommendedPerson } from "../../lib/api/social.ts";

export type FollowState = "FOLLOWING" | "PENDING" | null;
export type RecommendationPage = { totalCount: number; recommendedUsers: RecommendedPerson[] };
export const RECOMMENDATION_PAGE_SIZE = 20;

export function recommendationFollowState(person: RecommendedPerson, outgoing: readonly OutgoingRequest[], overrides: Readonly<Record<number, FollowState>>): FollowState {
  if (Object.hasOwn(overrides, person.userId)) return overrides[person.userId];
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

/** Offset recommendations shrink after follow: replace the entire loaded prefix atomically. */
export async function loadRecommendationPrefix(lastPage: number, fetchPage: (page: number, size: number) => Promise<RecommendationPage>): Promise<RecommendationPage[]> {
  return Promise.all(Array.from({ length: lastPage + 1 }, (_, page) => fetchPage(page, RECOMMENDATION_PAGE_SIZE)));
}

export function recommendationsHaveMore(lastPage: number, totalCount: number): boolean {
  return (lastPage + 1) * RECOMMENDATION_PAGE_SIZE < totalCount;
}

/** Invalidates late results when a keyed account scope unmounts (including StrictMode effect replay). */
export class RecommendationRequests {
  private generation = 0;
  capture(): () => boolean {
    const generation = this.generation;
    return () => generation === this.generation;
  }
  invalidate(): void {
    this.generation++;
  }
}

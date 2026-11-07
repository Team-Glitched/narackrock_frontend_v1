import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { profileKeys } from "@/features/profile/profile-queries";
import type { UserProfile } from "@/lib/api/contracts";
import {
  followPerson,
  getFollowRequests,
  getMutualFollowers,
  getOutgoingFollowRequests,
  getRecommendations,
  reviewFollowRequest,
  unfollowPerson,
  type OutgoingRequest,
} from "@/lib/api/social";
import { queryScope } from "@/lib/query";
import {
  RECOMMENDATION_PAGE_SIZE,
  recommendationsHaveMore,
  type FollowState,
  type RecommendationPage,
} from "./recommendations";

export const socialKeys = {
  all: (userId: number | null) => [...queryScope(userId), "social"] as const,
  mutual: (userId: number | null) => [...socialKeys.all(userId), "mutual"] as const,
  followRequests: (userId: number | null) =>
    [...socialKeys.all(userId), "follow-requests"] as const,
  outgoingRequests: (userId: number | null) =>
    [...socialKeys.all(userId), "outgoing-requests"] as const,
  recommendations: (userId: number | null) =>
    [...socialKeys.all(userId), "recommendations"] as const,
};

export const mutualFollowersQuery = (userId: number | null) =>
  queryOptions({
    queryKey: socialKeys.mutual(userId),
    queryFn: ({ signal }) => getMutualFollowers(signal),
  });

export const followRequestsQuery = (userId: number | null) =>
  queryOptions({
    queryKey: socialKeys.followRequests(userId),
    queryFn: ({ signal }) => getFollowRequests(signal),
  });

export const outgoingRequestsQuery = (userId: number | null) =>
  queryOptions({
    queryKey: socialKeys.outgoingRequests(userId),
    queryFn: ({ signal }) => getOutgoingFollowRequests(signal),
  });

/** Offset pages; a refetch after a follow change reloads every loaded page and installs them together. */
export const recommendationsQuery = (userId: number | null) =>
  infiniteQueryOptions({
    queryKey: socialKeys.recommendations(userId),
    queryFn: ({ pageParam, signal }): Promise<RecommendationPage> =>
      getRecommendations(pageParam, RECOMMENDATION_PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastPage) =>
      recommendationsHaveMore(lastPage, last.totalCount) ? lastPage + 1 : undefined,
  });

/** Relations (profiles, follower lists, friends, recommendations) all change together after a follow-graph write. */
function invalidateRelations(queryClient: QueryClient, userId: number | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: profileKeys.all(userId) }),
    queryClient.invalidateQueries({ queryKey: socialKeys.all(userId) }),
  ]);
}

/**
 * Follow (`state === null`) or unfollow / cancel the pending request to `targetId`. The server's answer is written to the
 * cached profile, outgoing requests and recommendations before every relation query is refetched.
 */
export function useFollowMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetId,
      state,
    }: {
      targetId: number;
      state: FollowState;
    }): Promise<{ status: FollowState; requestId: number | null }> => {
      if (state) {
        await unfollowPerson(targetId);
        return { status: null, requestId: null };
      }
      return followPerson(targetId);
    },
    onSuccess: ({ status: next, requestId }, { targetId }) => {
      queryClient.setQueryData<UserProfile>(
        profileKeys.detail(userId, targetId),
        (profile) =>
          profile && {
            ...profile,
            relations: { ...profile.relations, isFollowing: next === "FOLLOWING" },
          },
      );
      queryClient.setQueryData<OutgoingRequest[]>(
        socialKeys.outgoingRequests(userId),
        (requests) => {
          const others = requests?.filter((request) => request.targetId !== targetId);
          return others && next === "PENDING" && userId !== null
            ? [...others, { id: requestId ?? -1, requesterId: userId, targetId }]
            : others;
        },
      );
      queryClient.setQueryData<InfiniteData<RecommendationPage, number>>(
        socialKeys.recommendations(userId),
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              recommendedUsers: page.recommendedUsers.map((person) =>
                person.userId === targetId
                  ? { ...person, isFollowing: next === "FOLLOWING" }
                  : person,
              ),
            })),
          },
      );
      return invalidateRelations(queryClient, userId);
    },
  });
}

export function useReviewFollowRequestMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, decision }: { requestId: number; decision: "accept" | "reject" }) =>
      reviewFollowRequest(requestId, decision),
    onSuccess: () => invalidateRelations(queryClient, userId),
  });
}

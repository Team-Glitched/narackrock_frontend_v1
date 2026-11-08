import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { compositionKeys } from "@/features/composition/composition-queries";
import {
  getContributionInbox,
  getSentContributions,
  listContributions,
  reviewContribution,
  type ContributionNotificationDto,
} from "@/lib/api/composition";

export const contributionKeys = {
  sent: (userId: number | null) => [...compositionKeys.all(userId), "sent-contributions"] as const,
  /** Every contribution of one project; part of the project's composition data. */
  project: (userId: number | null, projectId: number) =>
    [...compositionKeys.project(userId, projectId), "contributions"] as const,
  /** Contribution requests the account received as a project reviewer. */
  inbox: (userId: number | null) => [...compositionKeys.all(userId), "contribution-inbox"] as const,
};

export const contributionsQuery = (userId: number | null, projectId: number) =>
  queryOptions({
    queryKey: contributionKeys.project(userId, projectId),
    queryFn: ({ signal }) => listContributions(projectId, undefined, signal),
  });

export const sentContributionsQuery = (userId: number | null) =>
  infiniteQueryOptions({
    queryKey: contributionKeys.sent(userId),
    queryFn: ({ pageParam, signal }) => getSentContributions(pageParam, signal),
    initialPageParam: undefined as number | undefined,
    enabled: userId !== null,
    getNextPageParam: (last) =>
      last.page.hasMore && last.page.nextCursor != null ? last.page.nextCursor : undefined,
  });

export const contributionInboxQuery = (userId: number | null) =>
  queryOptions({
    queryKey: contributionKeys.inbox(userId),
    queryFn: ({ signal }) => getContributionInbox(signal),
  });

/**
 * Approves or rejects a contribution. The request leaves the inbox at once; the project's contributions, its tracks
 * (an approval merges the change) and the inbox are then reread before the mutation settles.
 */
export function useReviewContributionMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      contributionId,
      status,
      comment = null,
    }: {
      projectId: number;
      contributionId: number;
      status: "APPROVED" | "REJECTED";
      comment?: string | null;
    }) => reviewContribution(projectId, contributionId, status, comment),
    onSuccess: (_, { projectId, contributionId }) => {
      queryClient.setQueryData<ContributionNotificationDto[]>(
        contributionKeys.inbox(userId),
        (items) => items?.filter((item) => item.contributionId !== contributionId),
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: contributionKeys.project(userId, projectId) }),
        queryClient.invalidateQueries({ queryKey: compositionKeys.detail(userId, projectId) }),
        queryClient.invalidateQueries({ queryKey: contributionKeys.inbox(userId) }),
        queryClient.invalidateQueries({ queryKey: contributionKeys.sent(userId) }),
      ]);
    },
  });
}

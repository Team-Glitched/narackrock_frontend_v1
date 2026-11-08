import { useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageState } from "@/components/page-state";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { compositionQuery } from "@/features/composition/composition-queries";
import { ApiError } from "@/lib/api/client";
import { profileQuery } from "@/features/profile/profile-queries";
import type { ContributionDto } from "@/lib/api/composition";
import { badgeVariants, buttonVariants } from "@/styles/variants";
import {
  ContributionRequestCard,
  ContributionReviewActions,
  RequestTime,
} from "./contribution-request-card";
import { canReviewRequest, requestStatus } from "./contribution-presentation";
import {
  contributionInboxQuery,
  contributionsQuery,
  useReviewContributionMutation,
} from "./workspace-queries";
import { useWorkspace } from "./workspace-store";

function RequestPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scrollbar-none h-full overflow-y-auto px-5 pt-5 pb-8 text-app-fg">
      <h1 className="mb-6 text-title leading-8 font-bold">{title}</h1>
      {children}
    </section>
  );
}

function ReviewError({ error }: { error: Error }) {
  return (
    <p role="alert" className="mt-4 text-body leading-6 text-[#ff8d8d]">
      {error instanceof ApiError
        ? error.message
        : "요청을 처리하지 못했습니다. 다시 시도해 주세요."}
    </p>
  );
}

export function ReviewInboxScreen({
  onSelect,
  onOpenProject,
  onOpenProfile,
}: {
  onSelect: (id: number, projectId: number) => void;
  onOpenProject: (id: number, contributionId: number) => void;
  onOpenProfile: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  const inbox = useQuery(contributionInboxQuery(userId));
  const review = useReviewContributionMutation();
  const [notice, setNotice] = useState("");
  const items = inbox.data ?? [];
  return (
    <RequestPage title="받은 참여 요청">
      {inbox.isPending && (
        <p role="status" className="text-body text-app-muted">
          참여 요청을 불러오는 중...
        </p>
      )}
      {inbox.isError && (
        <div role="alert">
          <p>참여 요청을 불러오지 못했습니다.</p>
          <button
            className={buttonVariants({ tone: "secondary" })}
            onClick={() => void inbox.refetch()}
          >
            다시 시도
          </button>
        </div>
      )}
      {review.isError && <ReviewError error={review.error} />}
      {notice && (
        <p role="status" className="mb-4 text-body text-app-primary-soft">
          {notice}
        </p>
      )}
      {!inbox.isPending && !inbox.isError && !items.length && (
        <p className="py-12 text-center text-body text-app-muted">받은 참여 요청이 없습니다.</p>
      )}
      <ul className="m-0 list-none divide-y divide-app-border p-0">
        {items.map((item) => (
          <ContributionRequestCard
            key={`${item.projectId}:${item.contributionId}`}
            item={item}
            onOpenProject={onOpenProject}
            onOpenProfile={onOpenProfile}
            onOpenDetails={() => onSelect(item.contributionId, item.projectId)}
          >
            <ContributionReviewActions
              busy={review.isPending}
              onReview={(status) => {
                if (review.isPending) return;
                setNotice("");
                review.mutate(
                  { projectId: item.projectId, contributionId: item.contributionId, status },
                  {
                    onSuccess: () =>
                      setNotice(
                        status === "APPROVED"
                          ? "참여 요청을 수락했습니다."
                          : "참여 요청을 거절했습니다.",
                      ),
                  },
                );
              }}
            />
          </ContributionRequestCard>
        ))}
      </ul>
    </RequestPage>
  );
}

export function SubmissionsScreen({
  onSelect,
}: {
  onSelect: (id: number, projectId: number) => void;
}) {
  const { works } = useWorkspace();
  const userId = useCurrentUserId();
  const lists = useQueries({
    queries: works.map((work) => ({
      ...contributionsQuery(userId, work.id),
      enabled: userId !== null,
    })),
  });
  const loading = lists.some((list) => list.isPending);
  const failed = lists.some((list) => list.isError);
  const items = lists
    .flatMap(
      (list, index) =>
        list.data
          ?.filter((item) => item.userId === userId)
          .map((item) => ({ ...item, projectTitle: works[index].title })) ?? [],
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <RequestPage title="보낸 참여 요청">
      {loading && (
        <p role="status" className="text-body text-app-muted">
          참여 요청을 불러오는 중...
        </p>
      )}
      {failed && (
        <div role="alert">
          <p>일부 요청을 불러오지 못했습니다.</p>
          <button
            className={buttonVariants({ tone: "secondary" })}
            onClick={() =>
              lists.forEach((list) => {
                if (list.isError) void list.refetch();
              })
            }
          >
            다시 시도
          </button>
        </div>
      )}
      {!loading && !failed && !items.length && (
        <p className="py-12 text-center text-body text-app-muted">
          최근 참여한 음악의 요청이 여기에 표시됩니다.
        </p>
      )}
      <ul className="m-0 list-none divide-y divide-app-border p-0">
        {items.map((item) => (
          <li key={`${item.projectId}:${item.contributionId}`}>
            <button
              className="block w-full py-5 text-left"
              onClick={() => onSelect(item.contributionId, item.projectId)}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span
                  className={badgeVariants({
                    status:
                      item.approvalStatus === "PENDING"
                        ? "request"
                        : item.approvalStatus === "APPROVED"
                          ? "approved"
                          : "rejected",
                  })}
                >
                  {requestStatus[item.approvalStatus]}
                </span>
                <RequestTime createdAt={item.createdAt} />
              </div>
              <strong className="text-label leading-6 font-semibold [overflow-wrap:anywhere]">
                {item.projectTitle}
              </strong>
              {item.description && (
                <p className="mt-2 text-body leading-6 text-app-muted [overflow-wrap:anywhere]">
                  {item.description}
                </p>
              )}
              <span className="mt-3 block text-caption text-app-primary-soft">
                요청 상세 보기 →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </RequestPage>
  );
}

export function SubmissionDetailScreen({
  id,
  projectId,
  onResume,
}: {
  id: number;
  projectId: number | null;
  onResume: (id: number, contributionId: number) => void;
}) {
  const userId = useCurrentUserId();
  const contributions = useQuery({
    ...contributionsQuery(userId, projectId ?? 0),
    enabled: projectId !== null,
  });
  const composition = useQuery({
    ...compositionQuery(userId, projectId ?? 0),
    enabled: projectId !== null,
  });
  const review = useReviewContributionMutation();
  const [reviewed, setReviewed] = useState<ContributionDto | null>(null);
  const item = reviewed ?? contributions.data?.find((entry) => entry.contributionId === id);
  const own = item?.userId === userId;
  const ownerId = composition.data?.project.ownerId;
  const owner = useQuery({
    ...profileQuery(userId, ownerId ?? 0),
    enabled: own && ownerId != null,
  });
  if (projectId === null)
    return <PageState error>요청을 열 수 없습니다. 요청 목록에서 다시 선택해 주세요.</PageState>;
  if (contributions.isError || composition.isError)
    return (
      <PageState error>
        <div>
          <p>참여 요청을 불러오지 못했습니다.</p>
          <button
            className={buttonVariants({ tone: "secondary" })}
            onClick={() => {
              void contributions.refetch();
              void composition.refetch();
            }}
          >
            다시 시도
          </button>
        </div>
      </PageState>
    );
  if (contributions.isPending || composition.isPending || (!item && review.isPending))
    return <PageState>참여 요청을 불러오는 중...</PageState>;
  if (!item || !composition.data)
    return (
      <PageState error>
        요청을 찾을 수 없습니다. 이미 처리되었거나 삭제된 요청일 수 있습니다.
      </PageState>
    );
  const canReview = canReviewRequest(item, composition.data.viewerPermission);
  const nickname = own ? owner.data?.nickname || "원곡자" : item.nickname || "알 수 없는 사용자";
  const imageUrl = own ? owner.data?.profileImageUrl : item.profileImageUrl;
  return (
    <RequestPage title={own ? "보낸 참여 요청" : "받은 참여 요청"}>
      <div className="mb-6 flex items-center gap-3">
        <Avatar src={imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-caption text-app-muted">{own ? "받는 사람" : "보낸 사람"}</p>
          <strong className="text-label font-semibold [overflow-wrap:anywhere]">{nickname}</strong>
        </div>
        <RequestTime createdAt={item.createdAt} />
      </div>
      <span
        className={badgeVariants({
          status:
            item.approvalStatus === "PENDING"
              ? "request"
              : item.approvalStatus === "APPROVED"
                ? "approved"
                : "rejected",
        })}
      >
        {requestStatus[item.approvalStatus]}
      </span>
      <h2 className="mt-3 text-title leading-8 font-semibold [overflow-wrap:anywhere]">
        {composition.data.project.title}
      </h2>
      {item.description?.trim() && (
        <p className="mt-4 whitespace-pre-wrap text-body leading-7 text-app-muted [overflow-wrap:anywhere]">
          {item.description}
        </p>
      )}
      <button
        className="mt-6 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-left text-label font-medium"
        onClick={() => onResume(projectId, id)}
      >
        전체 트랙 보기
        <ArrowUpRight size={20} aria-hidden="true" />
      </button>
      {canReview && (
        <ContributionReviewActions
          busy={review.isPending}
          onReview={(status) => {
            if (review.isPending) return;
            review.mutate(
              { projectId, contributionId: id, status },
              {
                onSuccess: (result) =>
                  setReviewed({
                    ...item,
                    approvalStatus: result.approvalStatus,
                    reviewedAt: result.reviewedAt,
                    reviewedBy: result.reviewedBy,
                    reviewComment: result.reviewComment,
                  }),
              },
            );
          }}
        />
      )}
      {review.isError && <ReviewError error={review.error} />}
    </RequestPage>
  );
}

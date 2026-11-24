import { useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
  MODERATION_REASON_MAX_LENGTH,
  clampCodePoints,
  sanitizeSingleLine,
} from "@/lib/content-limits";
import {
  ContributionRequestCard,
  ContributionReviewActions,
  RequestTime,
} from "./contribution-request-card";
import { canReviewRequest, requestStatus, requestTone } from "./contribution-presentation";
import {
  contributionInboxQuery,
  sentContributionsQuery,
  contributionsQuery,
  useReviewContributionMutation,
} from "./workspace-queries";

function RequestPage({
  title,
  hideTitle = false,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="scrollbar-none flex h-full flex-col gap-5 overflow-y-auto px-5 pt-6 pb-10 text-app-fg">
      {!hideTitle && <h1 className="m-0 text-title leading-7 font-bold">{title}</h1>}
      {children}
    </section>
  );
}

export function reviewErrorMessage(error: Error) {
  return error instanceof ApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

function ReviewError({ error }: { error: Error }) {
  return (
    <p role="alert" className="m-0 text-label leading-6 text-[#ff8d8d]">
      {reviewErrorMessage(error)}
    </p>
  );
}

/** Received contribution requests; `decide` approves or rejects one and reports it in `notice`. */
export function useReviewInbox() {
  const userId = useCurrentUserId();
  const inbox = useQuery(contributionInboxQuery(userId));
  const review = useReviewContributionMutation();
  const [notice, setNotice] = useState("");
  function decide(
    item: { projectId: number; contributionId: number },
    status: "APPROVED" | "REJECTED",
  ) {
    if (review.isPending) return;
    setNotice("");
    review.mutate(
      { projectId: item.projectId, contributionId: item.contributionId, status },
      {
        onSuccess: () =>
          setNotice(
            status === "APPROVED" ? "참여 요청을 수락했습니다." : "참여 요청을 거절했습니다.",
          ),
      },
    );
  }
  return { inbox, items: inbox.data ?? [], review, notice, decide };
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
  const { inbox, items, review, notice, decide } = useReviewInbox();
  return (
    <RequestPage title="받은 참여 요청" hideTitle={items.length === 0}>
      {inbox.isPending && (
        <p
          role="status"
          className="my-auto flex flex-1 items-center justify-center py-12 text-center text-label leading-6 text-app-muted"
        >
          참여 요청을 불러오는 중...
        </p>
      )}
      {inbox.isError && (
        <div
          role="alert"
          className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted"
        >
          <p className="m-0">참여 요청을 불러오지 못했습니다.</p>
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
        <p role="status" className="m-0 text-label leading-6 text-app-primary-soft">
          {notice}
        </p>
      )}
      {!inbox.isPending && !inbox.isError && !items.length && (
        <div className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted">
          <p className="m-0">받은 참여 요청이 없습니다.</p>
          <button
            type="button"
            className={buttonVariants({ tone: "secondary" })}
            disabled={inbox.isFetching}
            onClick={() => void inbox.refetch()}
          >
            새로고침
          </button>
        </div>
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
              onReview={(status) => decide(item, status)}
            />
          </ContributionRequestCard>
        ))}
      </ul>
    </RequestPage>
  );
}

/** Sent contribution requests, page by page; `retry` repeats whichever load failed. */
export function useSubmissions() {
  const userId = useCurrentUserId();
  const list = useInfiniteQuery(sentContributionsQuery(userId));
  return {
    list,
    items: list.data?.pages.flatMap((page) => page.items) ?? [],
    loading: list.isPending,
    failed: list.isError,
    retry: () =>
      list.isFetchNextPageError
        ? void list.fetchNextPage({ cancelRefetch: false })
        : void list.refetch(),
    more: () => void list.fetchNextPage({ cancelRefetch: false }),
  };
}

export function SubmissionsScreen({
  onSelect,
}: {
  onSelect: (id: number, projectId: number) => void;
}) {
  const { list, items, loading, failed, retry, more } = useSubmissions();
  return (
    <RequestPage title="보낸 참여 요청" hideTitle={items.length === 0}>
      {loading && (
        <p
          role="status"
          className="my-auto flex flex-1 items-center justify-center py-12 text-center text-label leading-6 text-app-muted"
        >
          참여 요청을 불러오는 중...
        </p>
      )}
      {failed && (
        <div
          role="alert"
          className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted"
        >
          <p className="m-0">보낸 요청을 불러오지 못했습니다.</p>
          <button className={buttonVariants({ tone: "secondary" })} onClick={retry}>
            다시 시도
          </button>
        </div>
      )}
      {!loading && !failed && !items.length && (
        <div className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted">
          <p className="m-0">아직 보낸 참여 요청이 없습니다.</p>
          <button
            type="button"
            className={buttonVariants({ tone: "secondary" })}
            disabled={list.isFetching}
            onClick={() => void list.refetch()}
          >
            새로고침
          </button>
        </div>
      )}
      <ul className="m-0 list-none divide-y divide-app-border p-0">
        {items.map((item) => (
          <li key={`${item.projectId}:${item.contributionId}`}>
            <button
              className="block w-full py-5 text-left"
              onClick={() => onSelect(item.contributionId, item.projectId)}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className={badgeVariants({ status: requestTone(item.approvalStatus) })}>
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
      {list.hasNextPage && (
        <button
          type="button"
          className={buttonVariants({ tone: "secondary" })}
          disabled={list.isFetchingNextPage}
          onClick={more}
        >
          {list.isFetchingNextPage ? "불러오는 중..." : "더보기"}
        </button>
      )}
    </RequestPage>
  );
}

/**
 * One contribution request with the web's review rule: the reviewed result replaces the listed entry,
 * and the reason goes to the requester only for a rejection.
 */
export function useSubmissionDetail(id: number, projectId: number | null) {
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
  function submit(status: "APPROVED" | "REJECTED", reason: string) {
    if (review.isPending || !item || projectId === null) return;
    review.mutate(
      // The reason is shown to the requester only for a rejection.
      {
        projectId,
        contributionId: id,
        status,
        comment: status === "REJECTED" ? sanitizeSingleLine(reason) || null : null,
      },
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
  }
  return {
    contributions,
    composition,
    review,
    item,
    own,
    owner,
    canReview: item !== undefined && canReviewRequest(item, composition.data?.viewerPermission),
    submit,
    retry: () => {
      void contributions.refetch();
      void composition.refetch();
    },
  };
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
  const detail = useSubmissionDetail(id, projectId);
  const { contributions, composition, review, item, own, owner, submit } = detail;
  const [reason, setReason] = useState("");
  if (projectId === null)
    return <PageState error>요청을 열 수 없습니다. 요청 목록에서 다시 선택해 주세요.</PageState>;
  if (contributions.isError || composition.isError)
    return (
      <PageState error>
        <div>
          <p>참여 요청을 불러오지 못했습니다.</p>
          <button className={buttonVariants({ tone: "secondary" })} onClick={detail.retry}>
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
  const canReview = detail.canReview;
  const nickname = own ? owner.data?.nickname || "원곡자" : item.nickname || "알 수 없는 사용자";
  const imageUrl = own ? owner.data?.profileImageUrl : item.profileImageUrl;
  return (
    <RequestPage title={own ? "보낸 참여 요청" : "받은 참여 요청"}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-caption text-app-muted">{own ? "받는 사람" : "보낸 사람"}</p>
            <strong className="text-label font-semibold [overflow-wrap:anywhere]">{nickname}</strong>
          </div>
          <RequestTime createdAt={item.createdAt} />
        </div>
        <span className={badgeVariants({ status: requestTone(item.approvalStatus) })}>
          {requestStatus[item.approvalStatus]}
        </span>
        <h2 className="m-0 text-label leading-6 font-semibold [overflow-wrap:anywhere]">
          {composition.data.project.title}
        </h2>
        {item.description?.trim() && (
          <p className="m-0 whitespace-pre-wrap text-body leading-7 text-app-muted [overflow-wrap:anywhere]">
            {item.description}
          </p>
        )}
        {item.approvalStatus === "REJECTED" && item.reviewComment?.trim() && (
          <section
            className="rounded-xl border border-app-border bg-app-surface px-4 py-3"
            aria-label="거절 사유"
          >
            <h3 className="mb-1 text-label font-semibold text-app-muted">거절 사유</h3>
            <p className="m-0 whitespace-pre-wrap text-body leading-6 [overflow-wrap:anywhere]">
              {item.reviewComment}
            </p>
          </section>
        )}
        <button
          className="mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-left text-label font-medium"
          onClick={() => onResume(projectId, id)}
        >
          전체 트랙 보기
          <ArrowUpRight size={20} aria-hidden="true" />
        </button>
      </div>
      {canReview && (
        <>
          <label className="mt-6 block">
            <span className="mb-2 block text-label font-semibold text-app-muted">
              거절 사유 (선택)
            </span>
            <textarea
              className="box-border min-h-20 w-full resize-y rounded-xl border border-app-border bg-app-surface p-3 text-body text-app-fg"
              placeholder="거절할 때 참여자에게 보여줄 사유를 적어 주세요."
              value={reason}
              disabled={review.isPending}
              onChange={(event) =>
                setReason(clampCodePoints(event.target.value, MODERATION_REASON_MAX_LENGTH))
              }
            />
          </label>
          <ContributionReviewActions
            busy={review.isPending}
            onReview={(status) => submit(status, reason)}
          />
        </>
      )}
      {review.isError && <ReviewError error={review.error} />}
    </RequestPage>
  );
}

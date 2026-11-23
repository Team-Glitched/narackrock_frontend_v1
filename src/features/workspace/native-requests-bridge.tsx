import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type {
  NativeHeader,
  NativeReviews,
  NativeSubmission,
  NativeSubmissions,
} from "@/lib/native-screens";
import { requestAge, requestStatus, requestTone } from "./contribution-presentation";
import { useMinuteClock } from "./contribution-request-card";
import {
  reviewErrorMessage,
  useReviewInbox,
  useSubmissionDetail,
  useSubmissions,
} from "./contribution-requests";

const header: NativeHeader = { left: "back", actions: ["notifications", "chat", "search", "account"] };

const status = (approval: keyof typeof requestStatus) => ({
  label: requestStatus[approval],
  tone: requestTone(approval),
});

type Navigation = { onSearch: () => void; onBack: () => void };

/** In the app the sent requests page (SubmissionsScreen) is drawn natively (native/screens/workspace/requests.tsx). */
export function NativeSubmissionsBridge({
  onSelect,
  onSearch,
  onBack,
}: Navigation & { onSelect: (id: number, projectId: number) => void }) {
  const { list, items, loading, failed, retry, more } = useSubmissions();
  const now = useMinuteClock();
  const model: NativeSubmissions = {
    loading,
    failed,
    items: items.map((item) => ({
      contributionId: item.contributionId,
      projectId: item.projectId,
      status: status(item.approvalStatus),
      ageLabel: requestAge(item.createdAt, now),
      projectTitle: item.projectTitle,
      description: item.description || null,
    })),
    fetching: list.isFetching,
    paging: list.hasNextPage ? { busy: list.isFetchingNextPage } : null,
  };
  return useNativeScreen("workspace-submissions", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "retry":
          return retry();
        case "reload":
          return void list.refetch();
        case "more":
          return more();
        case "open":
          return onSelect(action.contributionId, action.projectId);
      }
    },
  });
}

/** In the app one request (SubmissionDetailScreen) is drawn natively; `id` null is an invalid address. */
export function NativeSubmissionBridge({
  id,
  projectId,
  onResume,
  onSearch,
  onBack,
}: Navigation & {
  id: number | null;
  projectId: number | null;
  onResume: (id: number, contributionId: number) => void;
}) {
  const detail = useSubmissionDetail(id ?? 0, id === null ? null : projectId);
  const { contributions, composition, review, item, own, owner } = detail;
  const now = useMinuteClock();
  let model: NativeSubmission;
  if (id === null) model = { state: "invalid", message: "올바르지 않은 페이지 주소입니다." };
  else if (projectId === null)
    model = {
      state: "invalid",
      message: "요청을 열 수 없습니다. 요청 목록에서 다시 선택해 주세요.",
    };
  else if (contributions.isError || composition.isError)
    model = { state: "error", message: "참여 요청을 불러오지 못했습니다." };
  else if (contributions.isPending || composition.isPending || (!item && review.isPending))
    model = { state: "loading", message: "참여 요청을 불러오는 중..." };
  else if (!item || !composition.data)
    model = {
      state: "invalid",
      message: "요청을 찾을 수 없습니다. 이미 처리되었거나 삭제된 요청일 수 있습니다.",
    };
  else
    model = {
      state: "ready",
      title: own ? "보낸 참여 요청" : "받은 참여 요청",
      roleLabel: own ? "받는 사람" : "보낸 사람",
      nickname: own ? owner.data?.nickname || "원곡자" : item.nickname || "알 수 없는 사용자",
      profileImageUrl: (own ? owner.data?.profileImageUrl : item.profileImageUrl) ?? null,
      ageLabel: requestAge(item.createdAt, now),
      status: status(item.approvalStatus),
      projectTitle: composition.data.project.title,
      description: item.description?.trim() ? item.description : null,
      rejectReason:
        item.approvalStatus === "REJECTED" && item.reviewComment?.trim()
          ? item.reviewComment
          : null,
      projectId,
      contributionId: id,
      canReview: detail.canReview,
      reviewBusy: review.isPending,
      reviewError: review.isError ? reviewErrorMessage(review.error) : null,
    };
  return useNativeScreen("workspace-submission", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "retry":
          return detail.retry();
        case "resume":
          if (id !== null && projectId !== null) onResume(projectId, id);
          return;
        case "review":
          return detail.submit(action.status, action.reason);
      }
    },
  });
}

/** In the app the received requests page (ReviewInboxScreen) is drawn natively. */
export function NativeReviewsBridge({
  onSelect,
  onOpenProject,
  onOpenProfile,
  onSearch,
  onBack,
}: Navigation & {
  onSelect: (id: number, projectId: number) => void;
  onOpenProject: (id: number, contributionId: number) => void;
  onOpenProfile: (id: number) => void;
}) {
  const { inbox, items, review, notice, decide } = useReviewInbox();
  const now = useMinuteClock();
  const model: NativeReviews = {
    status: inbox.isPending ? "loading" : inbox.isError ? "error" : "ready",
    items: items.map((item) => ({
      contributionId: item.contributionId,
      projectId: item.projectId,
      userId: item.userId,
      nickname: item.nickname || "알 수 없는 사용자",
      ageLabel: requestAge(item.createdAt, now),
      projectTitle: item.projectTitle,
      description: item.description?.trim() ? item.description : null,
    })),
    fetching: inbox.isFetching,
    reviewBusy: review.isPending,
    reviewError: review.isError ? reviewErrorMessage(review.error) : null,
    notice: notice || null,
  };
  return useNativeScreen("workspace-reviews", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "retry":
        case "reload":
          return void inbox.refetch();
        case "open-profile":
          return onOpenProfile(action.userId);
        case "open-project":
          return onOpenProject(action.projectId, action.contributionId);
        case "open-details":
          return onSelect(action.contributionId, action.projectId);
        case "review":
          return decide(action, action.status);
      }
    },
  });
}

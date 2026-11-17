import type { ReactNode } from "react";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import type { Community } from "@/features/community/community-card";
import { useCommunityManagementNavigation } from "@/features/community/community-management-content";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { reportActions } from "@/lib/api/admin";
import type {
  NativeAdminCommunity,
  NativeAdminCommunityAction,
  NativeAdminList,
  NativeAdminReview,
  NativeHeader,
  NativeMoreAction,
} from "@/lib/native-screens";
import {
  banPeriod,
  banStatus,
  managerMeta,
  managerTitle,
  moderationLogRow,
  proposalMeta,
  reportActionLabels,
  reportMeta,
  reportTarget,
  useAdminReview,
  useCommunityAdminGate,
  useCommunityModeration,
  useGalleryManagers,
} from "./admin-screens";

const header: NativeHeader = { left: "back", actions: ["notifications", "search", "account"] };

type CursorList<T> = {
  loaded: boolean;
  error?: string;
  items: T[];
  hasNext: boolean;
  busy: boolean;
};

function nativeList<T, N>(list: CursorList<T>, map: (item: T) => N): NativeAdminList<N> {
  return {
    loaded: list.loaded,
    error: list.error ?? null,
    items: list.items.map(map),
    hasMore: list.hasNext,
    appending: list.busy,
  };
}

/** In the app the platform admin page (AdminReviewScreen) is drawn natively (native/screens/admin). */
export function NativeAdminReviewBridge({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: () => void;
}) {
  const review = useAdminReview();
  const { requestLogin } = useLoginPrompt();
  const model: NativeAdminReview = {
    signedIn: review.userId !== null,
    tab: review.tab,
    proposals: nativeList(review.proposals, (proposal) => ({
      proposalId: proposal.proposalId,
      name: proposal.name,
      description: proposal.description ?? "",
      meta: proposalMeta(proposal),
      ...review.proposalTask(proposal.proposalId),
    })),
    reports: nativeList(review.reports, (report) => ({
      reportId: report.reportId,
      target: reportTarget(report),
      reason: report.reason,
      description: report.description || null,
      contentSummary: report.contentSummary || null,
      meta: reportMeta(report),
      actions: reportActions(report.targetType).map((value) => ({
        value,
        label: reportActionLabels[value],
      })),
      ...review.reportTask(report.reportId),
    })),
  };
  return useNativeScreen("admin-review", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "sign-in":
          return requestLogin();
        case "tab":
          return review.setTab(action.tab);
        case "more":
          return (review.tab === "proposals" ? review.proposals : review.reports).more();
        case "approve":
        case "reject": {
          const proposal = review.proposals.items.find(
            (item) => item.proposalId === action.proposalId,
          );
          const reason = action.type === "reject" ? action.reason.trim() : null;
          if (proposal && reason !== "") void review.review(proposal, reason);
          return;
        }
        case "resolve-report":
        case "reject-report": {
          const report = review.reports.items.find((item) => item.reportId === action.reportId);
          const reason = action.reason.trim();
          if (!report || !reason) return;
          void review.handle(
            report,
            action.type === "reject-report"
              ? null
              : {
                  action: action.action,
                  banDays: action.action === "BAN_USER" ? action.banDays : null,
                },
            reason,
          );
          return;
        }
      }
    },
  });
}

type ScreenOptions = {
  /** null on the members page, which has no web Header. */
  header: NativeHeader | null;
  onBack?: () => void;
  onSearch: () => void;
};

function AdminCommunityView({
  view,
  options,
  onAction,
}: {
  view: NativeAdminCommunity["view"];
  options: ScreenOptions;
  onAction?: (action: NativeAdminCommunityAction | NativeMoreAction) => void;
}): ReactNode {
  return useNativeScreen("admin-community", { view }, { ...options, onAction });
}

/**
 * In the app the community management pages (/communities/manage and /communities/:id/members;
 * CommunityManagementContent) are drawn natively. A community's own page (/communities/:id) is the
 * social community detail screen, which shows managers the "관리자 페이지" button.
 */
export function NativeCommunityAdminBridge({
  galleryId,
  invalid,
  onBack,
  onSearch,
}: {
  galleryId: number | null;
  /** The route's gallery ID is not a number. */
  invalid: boolean;
  /** The web Header's back; absent on the members page (no Header). */
  onBack?: () => void;
  onSearch: () => void;
}) {
  const options: ScreenOptions = { header: onBack ? header : null, onBack, onSearch };
  if (invalid)
    return (
      <AdminCommunityView
        view={{ type: "page-state", text: "올바르지 않은 페이지 주소입니다.", error: true }}
        options={options}
      />
    );
  return <ManagementBridge galleryId={galleryId} options={options} />;
}

function ManagementBridge({
  galleryId,
  options,
}: {
  galleryId: number | null;
  options: ScreenOptions;
}) {
  const result = useRouteCommunity(galleryId);
  if (galleryId !== null && result.status !== "ready")
    return (
      <AdminCommunityView
        view={{
          type: "page-state",
          text:
            result.status === "loading"
              ? "커뮤니티를 불러오는 중..."
              : "커뮤니티를 찾을 수 없습니다.",
          error: result.status !== "loading",
        }}
        options={options}
      />
    );
  const community = result.status === "ready" ? result.community : null;
  return <GateBridge galleryId={galleryId} community={community} options={options} />;
}

function GateBridge({
  galleryId,
  community,
  options,
}: {
  galleryId: number | null;
  community: Community | null;
  options: ScreenOptions;
}) {
  const navigation = useCommunityManagementNavigation(galleryId);
  const { requestLogin } = useLoginPrompt();
  const gate = useCommunityAdminGate(community);
  if (gate.view === "manage" && community)
    return (
      <MembersBridge
        key={community.galleryId}
        community={community}
        onLeave={navigation.onBack}
        options={options}
      />
    );
  const { galleries } = gate;
  const view: NativeAdminCommunity["view"] =
    gate.view === "signed-out"
      ? { type: "sign-in", text: "커뮤니티 관리는 로그인 후 사용할 수 있습니다." }
      : gate.view === "galleries" || !community
        ? {
            type: "galleries",
            status:
              !galleries || galleries.busy
                ? "loading"
                : galleries.error
                  ? "error"
                  : galleries.items.length === 0
                    ? "empty"
                    : "ready",
            items: (galleries?.items ?? []).map((gallery) => ({
              galleryId: gallery.galleryId,
              name: gallery.name,
            })),
          }
        : gate.view === "role"
          ? gate.roleFailed
            ? {
                type: "status",
                text: "관리 권한을 확인하지 못했습니다.",
                error: true,
                button: "retry",
              }
            : { type: "status", text: "관리 권한을 확인하는 중...", error: false, button: null }
          : {
              type: "status",
              text: "이 커뮤니티의 커뮤니티 어드민만 관리할 수 있습니다.",
              error: true,
              button: "back",
            };
  return (
    <AdminCommunityView
      view={view}
      options={options}
      onAction={(action) => {
        switch (action.type) {
          case "sign-in":
            return requestLogin();
          case "retry":
            return gate.view === "role" ? gate.retryRole() : gate.retryGalleries();
          case "leave":
            return navigation.onBack();
          case "select":
            return navigation.onSelect({ galleryId: action.galleryId });
        }
      }}
    />
  );
}

function MembersBridge({
  community,
  onLeave,
  options,
}: {
  community: Community;
  onLeave: () => void;
  options: ScreenOptions;
}) {
  const moderation = useCommunityModeration(community);
  const managers = useGalleryManagers(community);
  const view: NativeAdminCommunity["view"] = {
    type: "members",
    galleryId: community.galleryId,
    name: community.name,
    description: community.description ?? "",
    saving: moderation.saving,
    notice: moderation.notice,
    lifting: moderation.lifting,
    bans: nativeList(moderation.bans, (ban) => ({
      banId: ban.banId,
      status: banStatus(ban),
      title: `사용자 #${ban.userId}`,
      reason: ban.reason,
      period: banPeriod(ban),
      active: ban.active,
    })),
    logs: nativeList(moderation.logs, (log) => ({ logId: log.logId, ...moderationLogRow(log) })),
    managers: {
      ...managers.managers,
      items: managers.managers.items.map((manager) => ({
        userId: manager.userId,
        title: managerTitle(manager),
        meta: managerMeta(manager),
        avatarUrl: manager.profileImageUrl,
      })),
      hasMore: false,
      appending: false,
    },
    managerSearch: {
      status: managers.search.status,
      items: managers.search.items.map((person) => ({
        userId: person.userId,
        title: managerTitle(person),
        subtitle: person.primaryInstrument ?? "",
        avatarUrl: person.profileImageUrl,
        manager: managers.isManager(person.userId),
      })),
    },
    managerBusy: managers.busy,
    managerNotice: managers.notice,
  };
  return (
    <AdminCommunityView
      view={view}
      options={options}
      onAction={(action) => {
        switch (action.type) {
          case "save-description":
            return moderation.save(action.text);
          case "lift-ban":
            if (!moderation.lifting) moderation.lift(action.banId);
            return;
          case "more-bans":
            return moderation.bans.more();
          case "more-logs":
            return moderation.logs.more();
          case "search-managers":
            return managers.runSearch(action.keyword);
          case "grant-manager":
            if (!managers.busy) managers.grant(action.userId);
            return;
          case "revoke-manager":
            if (!managers.busy) managers.revoke(action.userId);
            return;
          case "leave":
            return onLeave();
        }
      }}
    />
  );
}

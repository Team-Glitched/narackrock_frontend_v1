import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { workspaceStyles } from "@/styles/workspace.styles";
import { buttonVariants } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { CommunityDetailScreen } from "@/features/community/community-detail";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import { usePagedItems } from "@/hooks/use-paged-items";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { ApiError } from "@/lib/api/client";
import {
  fetchManageableGalleries,
  liftGalleryBan,
  updateGalleryDescription,
  type GalleryBan,
  type GalleryModerationLog,
} from "@/lib/api/community";
import {
  approveGalleryProposal,
  rejectGalleryProposal,
  rejectReport,
  reportActions,
  resolveReport,
  type AdminReport,
  type GalleryProposal,
  type ReportAction,
} from "@/lib/api/admin";
import { galleryKeys } from "@/features/community/community-queries";
import {
  adminKeys,
  galleryBansQuery,
  moderationLogsQuery,
  pendingProposalsQuery,
  pendingReportsQuery,
  reportedContentKey,
  type CursorPage,
} from "./admin-queries";

function adminError(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "로그인이 필요합니다.";
    if (cause.status === 403) return "권한이 없습니다.";
    if (cause.status === 409) return cause.message || "이미 처리된 요청입니다.";
    return cause.message || fallback;
  }
  return cause instanceof TypeError ? "서버에 연결하지 못했습니다." : fallback;
}

const date = (value: string | null) => (value ? new Date(value).toLocaleString("ko-KR") : "");

type CursorPages<T> = InfiniteData<CursorPage<T>>;

/** Cursor list that keeps following `nextCursor` on demand. */
function useCursorList<T>(options: UseInfiniteQueryOptions<CursorPage<T>, Error, CursorPages<T>, readonly unknown[], number | null>) {
  const queryClient = useQueryClient();
  const { data, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery(options);
  return {
    items: data?.pages.flatMap((page) => page.items) ?? [],
    hasNext: hasNextPage,
    error: error ? adminError(error, "목록을 불러오지 못했습니다.") : undefined,
    loaded: data !== undefined || (error !== null && !isFetching),
    busy: isFetchingNextPage,
    more: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    remove: (predicate: (item: T) => boolean) =>
      queryClient.setQueryData<CursorPages<T>>(options.queryKey, (old) =>
        old && { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.filter((item) => !predicate(item)) })) },
      ),
  };
}

function ProposalCard({ proposal, onDone }: { proposal: GalleryProposal; onDone: () => void }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const review = useMutation({
    mutationFn: (rejection: string | null) =>
      rejection === null ? approveGalleryProposal(proposal.proposalId) : rejectGalleryProposal(proposal.proposalId, rejection),
    onSuccess: (_, rejection) => {
      // An approval creates a gallery.
      if (rejection === null) void queryClient.invalidateQueries({ queryKey: galleryKeys.all(userId) });
      onDone();
    },
  });
  const busy = review.isPending;
  const error = review.error ? adminError(review.error, "신청을 처리하지 못했습니다.") : "";
  return (
    <article className={workspaceStyles.workspaceCard}>
      <span className={workspaceStyles.workspaceStatus}>커뮤니티 개설 신청</span>
      <h2>{proposal.name}</h2>
      <p>{proposal.description ?? ""}</p>
      <small>
        신청자 #{proposal.proposerId} · {date(proposal.createdAt)}
      </small>
      <input aria-label={`${proposal.name} 반려 사유`} placeholder="반려 사유" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <div className={workspaceStyles.workspaceActions}>
        <button disabled={busy || !reason.trim()} onClick={() => review.mutate(reason.trim())}>
          반려
        </button>
        <button className={workspaceStyles.workspacePrimary} disabled={busy} onClick={() => review.mutate(null)}>
          승인
        </button>
      </div>
    </article>
  );
}

const actionLabels: Record<ReportAction, string> = {
  DELETE_CONTENT: "콘텐츠 삭제",
  WARN_USER: "작성자 경고",
  BAN_USER: "작성자 정지",
  NONE: "조치 없음",
};

function ReportCard({ report, onDone }: { report: AdminReport; onDone: () => void }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const actions = reportActions(report.targetType);
  const [action, setAction] = useState<ReportAction>(actions[0]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const handle = useMutation({
    mutationFn: (resolution: { action: ReportAction; banDays: number | null } | null) =>
      resolution === null
        ? rejectReport(report.reportId, reason.trim())
        : resolveReport(report.reportId, resolution.action, reason.trim(), resolution.banDays),
    onSuccess: (_, resolution) => {
      if (resolution?.action === "DELETE_CONTENT")
        void queryClient.invalidateQueries({ queryKey: reportedContentKey(userId, report.targetType) });
      onDone();
    },
  });
  const busy = handle.isPending;
  const error = handle.error ? adminError(handle.error, "신고를 처리하지 못했습니다.") : "";
  const banDays = days.trim() === "" ? null : Number(days);
  const validDays = banDays === null || (Number.isInteger(banDays) && banDays >= 1);
  return (
    <article className={workspaceStyles.workspaceCard}>
      <span className={workspaceStyles.workspaceStatus}>
        {report.targetType} #{report.targetId}
        {report.targetDeleted ? " · 삭제됨" : ""}
      </span>
      <h2>{report.reason}</h2>
      {report.description && <p>{report.description}</p>}
      {report.contentSummary && <p>“{report.contentSummary}”</p>}
      <small>
        신고자 {report.reporter?.nickname ?? "알 수 없음"} → 대상 {report.reportedUser?.nickname ?? "알 수 없음"} · {date(report.reportedAt)}
      </small>
      <label>
        처리
        <select aria-label="신고 처리 방식" value={action} onChange={(event) => setAction(event.target.value as ReportAction)}>
          {actions.map((value) => (
            <option key={value} value={value}>
              {actionLabels[value]}
            </option>
          ))}
        </select>
      </label>
      {action === "BAN_USER" && (
        <input aria-label="정지 기간(일, 비우면 영구)" placeholder="정지 기간(일) · 비우면 영구" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} />
      )}
      <input aria-label="처리 사유" placeholder="처리 사유" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <div className={workspaceStyles.workspaceActions}>
        <button disabled={busy || !reason.trim()} onClick={() => handle.mutate(null)}>
          신고 반려
        </button>
        <button
          className={workspaceStyles.workspacePrimary}
          disabled={busy || !reason.trim() || (action === "BAN_USER" && !validDays)}
          onClick={() => handle.mutate({ action, banDays: action === "BAN_USER" ? banDays : null })}
        >
          처리
        </button>
      </div>
    </article>
  );
}

/** Platform administrator review of community proposals and reports. Gallery managers are not admins. */
export function AdminReviewScreen() {
  const userId = useCurrentUserId();
  const [tab, setTab] = useState<"proposals" | "reports">("proposals");
  const proposals = useCursorList({ ...pendingProposalsQuery(userId), enabled: userId !== null });
  const reports = useCursorList({ ...pendingReportsQuery(userId), enabled: userId !== null });
  if (userId === null) return <SignInRequired>관리자 화면은 로그인 후 사용할 수 있습니다.</SignInRequired>;
  const list = tab === "proposals" ? proposals : reports;
  return (
    <section className={cn("admin-view", sharedStyles.scrollContent)} aria-label="관리자 화면">
      <h1>관리자</h1>
      <div className={workspaceStyles.workspaceTabs}>
        <button aria-pressed={tab === "proposals"} onClick={() => setTab("proposals")}>
          개설 신청
        </button>
        <button aria-pressed={tab === "reports"} onClick={() => setTab("reports")}>
          신고
        </button>
      </div>
      {!list.loaded && <p role="status">불러오는 중...</p>}
      {list.error && <p role="alert">{list.error}</p>}
      {list.loaded && !list.error && list.items.length === 0 && <p>대기 중인 항목이 없습니다.</p>}
      {tab === "proposals"
        ? proposals.items.map((proposal) => (
            <ProposalCard
              key={proposal.proposalId}
              proposal={proposal}
              onDone={() => proposals.remove((item) => item.proposalId === proposal.proposalId)}
            />
          ))
        : reports.items.map((report) => (
            <ReportCard key={report.reportId} report={report} onDone={() => reports.remove((item) => item.reportId === report.reportId)} />
          ))}
      {list.hasNext && (
        <button className={workspaceStyles.workspaceWide} disabled={list.busy} onClick={() => void list.more()}>
          더보기
        </button>
      )}
    </section>
  );
}

type CommunityAdminProps = {
  community: Community | null;
  members: boolean;
  onMembers: () => void;
  onBack: () => void;
  onSelect: (community: Community) => void;
  onComments: (postId: number) => void;
  onProfile: (userId: number) => void;
};

async function loadManageableGalleries(_: number, signal: AbortSignal) {
  return { items: await fetchManageableGalleries(signal), next: null };
}

export function CommunityAdminScreen(props: CommunityAdminProps) {
  const userId = useCurrentUserId();
  const { role, failed: roleFailed, retry: retryRole } = useGalleryRole(props.community?.galleryId ?? null);
  const { state: galleries, more: retryGalleries } = usePagedItems(
    ["admin", "manageable-galleries"], 0, loadManageableGalleries, props.community === null && userId !== null,
  );
  if (userId === null) return <SignInRequired>커뮤니티 관리는 로그인 후 사용할 수 있습니다.</SignInRequired>;
  if (!props.community)
    return (
      <section className={cn(communityStyles.communityAdminStatus, sharedStyles.scrollContent)}>
        <h1>커뮤니티 관리</h1>
        {!galleries || galleries.busy ? (
          <p role="status">관리 가능한 커뮤니티를 불러오는 중...</p>
        ) : galleries.error ? (
          <>
            <p role="alert">관리 가능한 커뮤니티를 불러오지 못했습니다.</p>
            <button className={buttonVariants({ tone: "secondary" })} onClick={retryGalleries}>
              다시 시도
            </button>
          </>
        ) : galleries.items.length === 0 ? (
          <p role="status">관리할 수 있는 커뮤니티가 없습니다.</p>
        ) : (
          <ul className={communityStyles.communityCardList}>
            {galleries.items.map((gallery) => (
              <li key={gallery.galleryId}>
                <button className={workspaceStyles.workspaceWide} onClick={() => props.onSelect(galleryToCommunity(gallery))}>
                  {gallery.name} 관리
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  if (!role)
    return (
      <section className={communityStyles.communityAdminStatus}>
        <h1>커뮤니티 관리</h1>
        {roleFailed ? (
          <>
            <p role="alert">관리 권한을 확인하지 못했습니다.</p>
            <button className={buttonVariants({ tone: "secondary" })} onClick={retryRole}>
              다시 시도
            </button>
          </>
        ) : (
          <p role="status">관리 권한을 확인하는 중...</p>
        )}
      </section>
    );
  if (!role.canManage)
    return (
      <section className={communityStyles.communityAdminStatus}>
        <h1>커뮤니티 관리</h1>
        <p role="alert">이 커뮤니티의 관리자만 관리할 수 있습니다.</p>
        <button className={buttonVariants({ tone: "secondary" })} onClick={props.onBack}>
          돌아가기
        </button>
      </section>
    );
  if (props.members) return <CommunityMembers community={props.community} onBack={props.onBack} />;
  return (
    <CommunityDetailScreen
      community={props.community}
      onManage={props.onMembers}
      onComments={props.onComments}
      onProfile={props.onProfile}
    />
  );
}

function CommunityMembers({ community, onBack }: { community: Community; onBack: () => void }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(community.description ?? "");
  const [notice, setNotice] = useState("");
  const bans = useCursorList<GalleryBan>(galleryBansQuery(userId, community.galleryId));
  const logs = useCursorList<GalleryModerationLog>(moderationLogsQuery(userId, community.galleryId));
  const saveDescription = useMutation({
    mutationFn: (text: string) => updateGalleryDescription(community.galleryId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.manageableGalleries(userId) });
    },
  });
  const lift = useMutation({
    mutationFn: (banId: number) => liftGalleryBan(community.galleryId, banId),
    // Both the ban list and the moderation log record the lift.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.gallery(userId, community.galleryId) }),
  });
  return (
    <section className={cn(communityStyles.communityMembersView, sharedStyles.scrollContent)} aria-label={`${community.name} 운영`}>
      <div className={socialStyles.searchLine}>
        <button onClick={onBack} aria-label="돌아가기">
          <Asset name="search-back.svg" />
        </button>
      </div>
      <p className={communityStyles.communityAdminEmpty} role="status">
        전체 멤버 목록은 현재 서버에서 지원하지 않습니다. 게시글·댓글 메뉴에서 작성자를 제재할 수 있습니다.
      </p>
      <form
        className={workspaceStyles.workspaceCard}
        onSubmit={(event) => {
          event.preventDefault();
          if (saveDescription.isPending) return;
          setNotice("");
          saveDescription.mutate(description.trim(), {
            onSuccess: () => setNotice("커뮤니티 설명을 저장했습니다."),
            onError: (cause) => setNotice(adminError(cause, "설명을 저장하지 못했습니다.")),
          });
        }}
      >
        <h2>커뮤니티 설명</h2>
        <textarea aria-label="커뮤니티 설명" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
        {notice && <p role="status">{notice}</p>}
        <button className={workspaceStyles.workspacePrimary} disabled={saveDescription.isPending}>
          {saveDescription.isPending ? "저장 중..." : "설명 저장"}
        </button>
      </form>
      <h2>제재 내역</h2>
      {bans.error && <p role="alert">{bans.error}</p>}
      {bans.loaded && bans.items.length === 0 && <p>제재 내역이 없습니다.</p>}
      {bans.items.map((ban) => (
        <article className={workspaceStyles.workspaceCard} key={ban.banId}>
          <span className={workspaceStyles.workspaceStatus}>
            {ban.banType === "SUSPEND" ? "이용정지" : "추방"} · {ban.active ? "진행 중" : ban.liftedAt ? "해제됨" : "만료"}
          </span>
          <h2>사용자 #{ban.userId}</h2>
          <p>{ban.reason}</p>
          <small>
            {date(ban.createdAt)}
            {ban.bannedUntil ? ` ~ ${date(ban.bannedUntil)}` : ""}
          </small>
          {ban.active && (
            <div className={workspaceStyles.workspaceActions}>
              <button
                disabled={lift.isPending}
                onClick={() =>
                  lift.mutate(ban.banId, { onError: (cause) => setNotice(adminError(cause, "제재를 해제하지 못했습니다.")) })
                }
              >
                제재 해제
              </button>
            </div>
          )}
        </article>
      ))}
      {bans.hasNext && (
        <button className={workspaceStyles.workspaceWide} disabled={bans.busy} onClick={() => void bans.more()}>
          제재 내역 더보기
        </button>
      )}
      <h2>운영 기록</h2>
      {logs.error && <p role="alert">{logs.error}</p>}
      {logs.loaded && logs.items.length === 0 && <p>운영 기록이 없습니다.</p>}
      <ul>
        {logs.items.map((log) => (
          <li key={log.logId}>
            {date(log.createdAt)} · {log.actionType}
            {log.targetUserId ? ` · 사용자 #${log.targetUserId}` : ""}
            {log.reason ? ` · ${log.reason}` : ""}
          </li>
        ))}
      </ul>
      {logs.hasNext && (
        <button className={workspaceStyles.workspaceWide} disabled={logs.busy} onClick={() => void logs.more()}>
          운영 기록 더보기
        </button>
      )}
    </section>
  );
}

import { Dropdown } from "@/components/dropdown";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { workspaceStyles } from "@/styles/workspace.styles";
import { badgeVariants, buttonVariants } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { useRef, useState, type ReactNode } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { SectionTitle } from "@/components/section-title";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import { usePagedItems } from "@/hooks/use-paged-items";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { ApiError } from "@/lib/api/client";
import {
  fetchManageableGalleries,
  grantGalleryManager,
  liftGalleryBan,
  revokeGalleryManager,
  updateGalleryDescription,
  type GalleryBan,
  type GalleryManager,
  type GalleryModerationLog,
} from "@/lib/api/community";
import { searchPeople, type SearchedPerson } from "@/lib/api/social";
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
  galleryManagersQuery,
  moderationLogsQuery,
  pendingProposalsQuery,
  pendingReportsQuery,
  reportedContentKey,
  type CursorPage,
} from "./admin-queries";
import { parseBanDays } from "./ban-days";

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
function useCursorList<T>(
  options: UseInfiniteQueryOptions<
    CursorPage<T>,
    Error,
    CursorPages<T>,
    readonly unknown[],
    number | null
  >,
) {
  const queryClient = useQueryClient();
  const { data, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery(options);
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
      queryClient.setQueryData<CursorPages<T>>(
        options.queryKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => !predicate(item)),
            })),
          },
      ),
  };
}

export type ItemTask = { busy: boolean; error: string };
const idleTask: ItemTask = { busy: false, error: "" };

/** One request at a time per list item (by id), with its pending state and last error. */
function useItemTasks() {
  const [tasks, setTasks] = useState<Record<number, ItemTask>>({});
  const running = useRef(new Set<number>());
  return {
    get: (id: number) => tasks[id] ?? idleTask,
    run: async (id: number, work: () => Promise<void>, fallback: string) => {
      if (running.current.has(id)) return;
      running.current.add(id);
      setTasks((old) => ({ ...old, [id]: { busy: true, error: "" } }));
      try {
        await work();
        setTasks((old) => ({ ...old, [id]: idleTask }));
      } catch (cause) {
        setTasks((old) => ({ ...old, [id]: { busy: false, error: adminError(cause, fallback) } }));
      } finally {
        running.current.delete(id);
      }
    },
  };
}

/** Pending community proposals and reports of the platform admin page, and their handling. */
export function useAdminReview() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"proposals" | "reports">("proposals");
  const proposals = useCursorList({ ...pendingProposalsQuery(userId), enabled: userId !== null });
  const reports = useCursorList({ ...pendingReportsQuery(userId), enabled: userId !== null });
  const proposalTasks = useItemTasks();
  const reportTasks = useItemTasks();
  return {
    userId,
    tab,
    setTab,
    proposals,
    reports,
    proposalTask: proposalTasks.get,
    reportTask: reportTasks.get,
    /** Approves (`null`) or rejects with a reason. */
    review: (proposal: GalleryProposal, rejection: string | null) =>
      proposalTasks.run(
        proposal.proposalId,
        async () => {
          if (rejection === null) {
            await approveGalleryProposal(proposal.proposalId);
            // An approval creates a gallery.
            void queryClient.invalidateQueries({ queryKey: galleryKeys.all(userId) });
          } else await rejectGalleryProposal(proposal.proposalId, rejection);
          proposals.remove((item) => item.proposalId === proposal.proposalId);
        },
        "신청을 처리하지 못했습니다.",
      ),
    /** Resolves with an action, or rejects the report (`null`). */
    handle: (
      report: AdminReport,
      resolution: { action: ReportAction; banDays: number | null } | null,
      reason: string,
    ) =>
      reportTasks.run(
        report.reportId,
        async () => {
          if (resolution === null) await rejectReport(report.reportId, reason);
          else await resolveReport(report.reportId, resolution.action, reason, resolution.banDays);
          if (resolution?.action === "DELETE_CONTENT")
            void queryClient.invalidateQueries({
              queryKey: reportedContentKey(userId, report.targetType),
            });
          reports.remove((item) => item.reportId === report.reportId);
        },
        "신고를 처리하지 못했습니다.",
      ),
  };
}

function ProposalCard({
  proposal,
  task,
  onReview,
}: {
  proposal: GalleryProposal;
  task: ItemTask;
  onReview: (rejection: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  const { busy, error } = task;
  return (
    <article className={workspaceStyles.workspaceCard}>
      <span className={workspaceStyles.workspaceStatus}>커뮤니티 개설 신청</span>
      <h2>{proposal.name}</h2>
      <p>{proposal.description ?? ""}</p>
      <small>{proposalMeta(proposal)}</small>
      <input
        aria-label={`${proposal.name} 반려 사유`}
        placeholder="반려 사유"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div className={workspaceStyles.workspaceActions}>
        <button disabled={busy || !reason.trim()} onClick={() => onReview(reason.trim())}>
          반려
        </button>
        <button
          className={workspaceStyles.workspacePrimary}
          disabled={busy}
          onClick={() => onReview(null)}
        >
          승인
        </button>
      </div>
    </article>
  );
}

export const proposalMeta = (proposal: GalleryProposal) =>
  `신청자 #${proposal.proposerId} · ${date(proposal.createdAt)}`;

export const reportActionLabels: Record<ReportAction, string> = {
  DELETE_CONTENT: "콘텐츠 삭제",
  WARN_USER: "작성자 경고",
  BAN_USER: "작성자 정지",
  NONE: "조치 없음",
};

export const reportTarget = (report: AdminReport) =>
  `${report.targetType} #${report.targetId}${report.targetDeleted ? " · 삭제됨" : ""}`;

export const reportMeta = (report: AdminReport) =>
  `신고자 ${report.reporter?.nickname ?? "알 수 없음"} → 대상 ${report.reportedUser?.nickname ?? "알 수 없음"} · ${date(report.reportedAt)}`;

function ReportCard({
  report,
  task,
  onHandle,
}: {
  report: AdminReport;
  task: ItemTask;
  onHandle: (
    resolution: { action: ReportAction; banDays: number | null } | null,
    reason: string,
  ) => void;
}) {
  const actions = reportActions(report.targetType);
  const [action, setAction] = useState<ReportAction>(actions[0]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const { busy, error } = task;
  const { banDays, valid: validDays } = parseBanDays(days);
  return (
    <article className={workspaceStyles.workspaceCard}>
      <span className={workspaceStyles.workspaceStatus}>{reportTarget(report)}</span>
      <h2>{report.reason}</h2>
      {report.description && <p>{report.description}</p>}
      {report.contentSummary && <p>“{report.contentSummary}”</p>}
      <small>{reportMeta(report)}</small>
      <div className="flex items-center gap-2 py-2 text-caption">
        <span>처리</span>
        <Dropdown
          label="신고 처리 방식"
          value={action}
          options={actions.map((value) => ({ value, label: reportActionLabels[value] }))}
          onChange={setAction}
        />
      </div>
      {action === "BAN_USER" && (
        <input
          aria-label="정지 기간(일, 비우면 영구)"
          placeholder="정지 기간(일) · 비우면 영구"
          inputMode="numeric"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      )}
      <input
        aria-label="처리 사유"
        placeholder="처리 사유"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div className={workspaceStyles.workspaceActions}>
        <button disabled={busy || !reason.trim()} onClick={() => onHandle(null, reason.trim())}>
          신고 반려
        </button>
        <button
          className={workspaceStyles.workspacePrimary}
          disabled={busy || !reason.trim() || (action === "BAN_USER" && !validDays)}
          onClick={() =>
            onHandle({ action, banDays: action === "BAN_USER" ? banDays : null }, reason.trim())
          }
        >
          처리
        </button>
      </div>
    </article>
  );
}

/** Platform administrator review of community proposals and reports. Gallery managers are not admins. */
export function AdminReviewScreen() {
  const { userId, tab, setTab, proposals, reports, proposalTask, reportTask, review, handle } =
    useAdminReview();
  if (userId === null)
    return <SignInRequired>운영자 관리 화면은 로그인 후 사용할 수 있습니다.</SignInRequired>;
  const list = tab === "proposals" ? proposals : reports;
  return (
    <section className={cn("admin-view", sharedStyles.scrollContent)} aria-label="운영자 관리">
      <h1>운영자 관리</h1>
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
              task={proposalTask(proposal.proposalId)}
              onReview={(rejection) => void review(proposal, rejection)}
            />
          ))
        : reports.items.map((report) => (
            <ReportCard
              key={report.reportId}
              report={report}
              task={reportTask(report.reportId)}
              onHandle={(resolution, reason) => void handle(report, resolution, reason)}
            />
          ))}
      {list.hasNext && (
        <button
          className={workspaceStyles.workspaceWide}
          disabled={list.busy}
          onClick={() => void list.more()}
        >
          더보기
        </button>
      )}
    </section>
  );
}

/** `community` null: the manageable list (`/communities/manage`); otherwise that community's members page. */
type CommunityAdminProps = {
  community: Community | null;
  onBack: () => void;
  onSelect: (community: Community) => void;
};

async function loadManageableGalleries(_: number, signal: AbortSignal) {
  return { items: await fetchManageableGalleries(signal), next: null };
}

/**
 * What community management shows before its content, in order: sign-in, the manageable
 * communities (no community chosen), the role check, the not-a-manager notice, then `manage`.
 */
export function useCommunityAdminGate(community: Community | null) {
  const userId = useCurrentUserId();
  const {
    role,
    failed: roleFailed,
    retry: retryRole,
  } = useGalleryRole(community?.galleryId ?? null);
  const { state: galleries, more: retryGalleries } = usePagedItems(
    ["admin", "manageable-galleries"],
    0,
    loadManageableGalleries,
    community === null && userId !== null,
  );
  const view =
    userId === null
      ? ("signed-out" as const)
      : !community
        ? ("galleries" as const)
        : !role
          ? ("role" as const)
          : !role.canManage
            ? ("forbidden" as const)
            : ("manage" as const);
  return { view, roleFailed, retryRole, galleries, retryGalleries };
}

export function CommunityAdminScreen(props: CommunityAdminProps) {
  const { view, roleFailed, retryRole, galleries, retryGalleries } = useCommunityAdminGate(
    props.community,
  );
  if (view === "signed-out")
    return <SignInRequired>커뮤니티 관리는 로그인 후 사용할 수 있습니다.</SignInRequired>;
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
                <button
                  className={workspaceStyles.workspaceWide}
                  onClick={() => props.onSelect(galleryToCommunity(gallery))}
                >
                  {gallery.name} 관리
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  if (view === "role")
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
  if (view === "forbidden")
    return (
      <section className={communityStyles.communityAdminStatus}>
        <h1>커뮤니티 관리</h1>
        <p role="alert">이 커뮤니티의 커뮤니티 어드민만 관리할 수 있습니다.</p>
        <button className={buttonVariants({ tone: "secondary" })} onClick={props.onBack}>
          돌아가기
        </button>
      </section>
    );
  return <CommunityMembers community={props.community} onBack={props.onBack} />;
}

/** A manager's moderation of a community: its description, bans (with lifting) and log. */
export function useCommunityModeration(community: Community) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const bans = useCursorList<GalleryBan>(galleryBansQuery(userId, community.galleryId));
  const logs = useCursorList<GalleryModerationLog>(
    moderationLogsQuery(userId, community.galleryId),
  );
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.gallery(userId, community.galleryId) }),
  });
  return {
    notice,
    bans,
    logs,
    saving: saveDescription.isPending,
    save: (description: string) => {
      if (saveDescription.isPending) return;
      setNotice("");
      saveDescription.mutate(description.trim(), {
        onSuccess: () => setNotice("커뮤니티 설명을 저장했습니다."),
        onError: (cause) => setNotice(adminError(cause, "설명을 저장하지 못했습니다.")),
      });
    },
    lifting: lift.isPending,
    lift: (banId: number) =>
      lift.mutate(banId, {
        onError: (cause) => setNotice(adminError(cause, "제재를 해제하지 못했습니다.")),
      }),
  };
}

export type ManagerSearch = {
  status: "idle" | "loading" | "error" | "ready";
  items: SearchedPerson[];
};

/** The community admins (`MANAGER`) of a community: the list, a nickname search, granting and revoking. */
export function useGalleryManagers(community: Community) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const managers = useQuery(galleryManagersQuery(userId, community.galleryId));
  const [search, setSearch] = useState<ManagerSearch>({ status: "idle", items: [] });
  const [notice, setNotice] = useState("");
  // Only the latest search may fill the results.
  const searchRun = useRef(0);
  const onChanged = () => {
    // The admin list and the log; the caller's own role when they revoked themselves.
    void queryClient.invalidateQueries({ queryKey: adminKeys.gallery(userId, community.galleryId) });
    void queryClient.invalidateQueries({ queryKey: galleryKeys.role(userId, community.galleryId) });
    void queryClient.invalidateQueries({ queryKey: adminKeys.manageableGalleries(userId) });
  };
  const grant = useMutation({
    mutationFn: (targetId: number) => grantGalleryManager(community.galleryId, targetId),
    onSuccess: onChanged,
  });
  const revoke = useMutation({
    mutationFn: (targetId: number) => revokeGalleryManager(community.galleryId, targetId),
    onSuccess: onChanged,
  });
  const items: GalleryManager[] = managers.data ?? [];
  return {
    managers: {
      loaded: managers.data !== undefined || managers.isError,
      error: managers.isError
        ? adminError(managers.error, "커뮤니티 어드민 목록을 불러오지 못했습니다.")
        : null,
      items,
    },
    search,
    /** Whether a search result is already a community admin. */
    isManager: (targetId: number) => items.some((manager) => manager.userId === targetId),
    runSearch: (keyword: string) => {
      const run = ++searchRun.current;
      const trimmed = keyword.trim();
      if (!trimmed) return setSearch({ status: "idle", items: [] });
      setSearch({ status: "loading", items: [] });
      void searchPeople(trimmed, 0, 10).then(
        (page) => run === searchRun.current && setSearch({ status: "ready", items: page.users }),
        () => run === searchRun.current && setSearch({ status: "error", items: [] }),
      );
    },
    busy: grant.isPending || revoke.isPending,
    grant: (targetId: number) => {
      setNotice("");
      grant.mutate(targetId, {
        onSuccess: () => setNotice("커뮤니티 어드민으로 지정했습니다."),
        onError: (cause) => setNotice(adminError(cause, "지정하지 못했습니다.")),
      });
    },
    revoke: (targetId: number) => {
      setNotice("");
      revoke.mutate(targetId, {
        onSuccess: () => setNotice("커뮤니티 어드민에서 해임했습니다."),
        onError: (cause) => setNotice(adminError(cause, "해임하지 못했습니다.")),
      });
    },
    notice,
  };
}

export const managerTitle = (manager: { userId: number; nickname: string | null }) =>
  manager.nickname ?? `사용자 #${manager.userId}`;

const day = (value: string) => new Date(value).toLocaleDateString("ko-KR");

export const managerMeta = (manager: GalleryManager) => `${day(manager.assignedAt)} 지정`;

const moderationActionLabels: Record<string, string> = {
  UPDATE_GALLERY: "커뮤니티 설명 수정",
  SUSPEND_USER: "이용정지",
  EXPEL_USER: "추방",
  LIFT_BAN: "제재 해제",
  DELETE_POST: "게시글 삭제",
  DELETE_COMMENT: "댓글 삭제",
  GRANT_MANAGER: "커뮤니티 어드민 지정",
  REVOKE_MANAGER: "커뮤니티 어드민 해임",
};

/** One moderation log entry as the web and the app show it. */
export const moderationLogRow = (log: GalleryModerationLog) => ({
  title: moderationActionLabels[log.actionType] ?? log.actionType,
  /** "사용자 #12 · 사유", or "" when the action has neither. */
  detail: [log.targetUserId ? `사용자 #${log.targetUserId}` : null, log.reason].filter(Boolean).join(" · "),
  time: date(log.createdAt),
});

export const banStatus = (ban: GalleryBan) =>
  `${ban.banType === "SUSPEND" ? "이용정지" : "추방"} · ${ban.active ? "진행 중" : ban.liftedAt ? "해제됨" : "만료"}`;

export const banPeriod = (ban: GalleryBan) =>
  `${day(ban.createdAt)}${ban.bannedUntil ? ` ~ ${day(ban.bannedUntil)}` : ""}`;

/** A person-style row: avatar (when given), a bold title, muted lines, then the row's actions. */
function ManageRow({
  avatar,
  title,
  lines,
  children,
}: {
  avatar?: { src: string | null };
  title: string;
  lines: string[];
  children?: ReactNode;
}) {
  return (
    <li className={communityStyles.communityMemberRow}>
      <div className={communityStyles.communityMemberProfile}>
        {avatar && <Avatar src={avatar.src} />}
        <span>
          <strong>{title}</strong>
          {lines.filter(Boolean).map((line) => (
            <small key={line}>{line}</small>
          ))}
        </span>
      </div>
      {children}
    </li>
  );
}

function ManageSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={communityStyles.communityManageSection} aria-label={title}>
      <SectionTitle className="mb-0 px-0">{title}</SectionTitle>
      {children}
    </section>
  );
}

function Muted({ children, status = false }: { children: ReactNode; status?: boolean }) {
  return (
    <p className={communityStyles.communityAdminEmpty} role={status ? "status" : undefined}>
      {children}
    </p>
  );
}

const moreButton = cn(buttonVariants({ tone: "secondary" }), "w-full");

function CommunityManagers({ community }: { community: Community }) {
  const [keyword, setKeyword] = useState("");
  const { managers, search, isManager, runSearch, busy, grant, revoke, notice } =
    useGalleryManagers(community);
  return (
    <>
      <ManageSection title="커뮤니티 어드민">
        {notice && <Muted status>{notice}</Muted>}
        {managers.error ? (
          <p role="alert">{managers.error}</p>
        ) : !managers.loaded ? (
          <Muted status>불러오는 중...</Muted>
        ) : (
          managers.items.length === 0 && <Muted>지정된 커뮤니티 어드민이 없습니다.</Muted>
        )}
        <ul className={communityStyles.communityMemberList}>
          {managers.items.map((manager) => (
            <ManageRow
              key={manager.userId}
              avatar={{ src: manager.profileImageUrl }}
              title={managerTitle(manager)}
              lines={[managerMeta(manager)]}
            >
              <button
                className={buttonVariants({ tone: "secondary" })}
                disabled={busy}
                onClick={() => revoke(manager.userId)}
              >
                해임
              </button>
            </ManageRow>
          ))}
        </ul>
      </ManageSection>
      <ManageSection title="어드민 지정">
        <form
          className={communityStyles.communityAdminSearch}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(keyword);
          }}
        >
          <input
            className="focus-visible:outline-none!"
            aria-label="닉네임으로 사용자 검색"
            placeholder="닉네임으로 사용자 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <button aria-label="검색">
            <Asset name="search-input.svg" />
          </button>
        </form>
        {search.status === "idle" && <Muted>지정할 사용자의 닉네임을 검색하세요.</Muted>}
        {search.status === "loading" && <Muted status>검색 중...</Muted>}
        {search.status === "error" && <p role="alert">사용자를 검색하지 못했습니다.</p>}
        {search.status === "ready" && search.items.length === 0 && <Muted>검색 결과가 없습니다.</Muted>}
        <ul className={communityStyles.communityMemberList}>
          {search.items.map((person) => (
            <ManageRow
              key={person.userId}
              avatar={{ src: person.profileImageUrl }}
              title={managerTitle(person)}
              lines={[person.primaryInstrument ?? ""]}
            >
              {isManager(person.userId) ? (
                <span className={cn(badgeVariants({ status: "resource" }), "mb-0")}>어드민</span>
              ) : (
                <button
                  className={buttonVariants({ tone: "primary" })}
                  disabled={busy}
                  onClick={() => grant(person.userId)}
                >
                  지정
                </button>
              )}
            </ManageRow>
          ))}
        </ul>
      </ManageSection>
    </>
  );
}

const DESCRIPTION_LIMIT = 1000;

function CommunityMembers({ community, onBack }: { community: Community; onBack: () => void }) {
  const [description, setDescription] = useState(community.description ?? "");
  const { notice, bans, logs, saving, save, lifting, lift } = useCommunityModeration(community);
  return (
    <section className={communityStyles.communityMembersView} aria-label={`${community.name} 운영`}>
      <div className={socialStyles.searchLine}>
        <button onClick={onBack} aria-label="돌아가기">
          <Asset name="search-back.svg" />
        </button>
        <h1 className={communityStyles.communityManageTitle}>
          <strong>{community.name}</strong>
          <small>커뮤니티 관리</small>
        </h1>
      </div>
      <div className={cn(communityStyles.communityMembersContent, sharedStyles.scrollContent)}>
        <CommunityManagers community={community} />
        <ManageSection title="커뮤니티 설명">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save(description);
            }}
          >
            <textarea
              className={communityStyles.communityManageTextarea}
              aria-label="커뮤니티 설명"
              placeholder="커뮤니티를 소개해 주세요."
              maxLength={DESCRIPTION_LIMIT}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className={communityStyles.communityManageFooter}>
              <small>
                {description.length}/{DESCRIPTION_LIMIT}
              </small>
              <button className={buttonVariants({ tone: "primary" })} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
            {notice && <Muted status>{notice}</Muted>}
          </form>
        </ManageSection>
        <ManageSection title="제재 내역">
          <Muted>멤버 제재는 게시글·댓글의 메뉴에서 할 수 있습니다.</Muted>
          {bans.error && <p role="alert">{bans.error}</p>}
          {bans.loaded && !bans.error && bans.items.length === 0 && (
            <Muted>제재 내역이 없습니다.</Muted>
          )}
          <ul className={communityStyles.communityMemberList}>
            {bans.items.map((ban) => (
              <ManageRow
                key={ban.banId}
                avatar={{ src: null }}
                title={`사용자 #${ban.userId}`}
                lines={[`${banStatus(ban)} · ${ban.reason}`, banPeriod(ban)]}
              >
                {ban.active && (
                  <button
                    className={buttonVariants({ tone: "secondary" })}
                    disabled={lifting}
                    onClick={() => lift(ban.banId)}
                  >
                    해제
                  </button>
                )}
              </ManageRow>
            ))}
          </ul>
          {bans.hasNext && (
            <button className={moreButton} disabled={bans.busy} onClick={() => void bans.more()}>
              제재 내역 더보기
            </button>
          )}
        </ManageSection>
        <ManageSection title="운영 기록">
          {logs.error && <p role="alert">{logs.error}</p>}
          {logs.loaded && !logs.error && logs.items.length === 0 && (
            <Muted>운영 기록이 없습니다.</Muted>
          )}
          <ul className={communityStyles.communityMemberList}>
            {logs.items.map((log) => {
              const row = moderationLogRow(log);
              return <ManageRow key={log.logId} title={row.title} lines={[row.detail, row.time]} />;
            })}
          </ul>
          {logs.hasNext && (
            <button className={moreButton} disabled={logs.busy} onClick={() => void logs.more()}>
              운영 기록 더보기
            </button>
          )}
        </ManageSection>
      </div>
    </section>
  );
}

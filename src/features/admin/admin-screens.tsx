import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { workspaceStyles } from "@/styles/workspace.styles";
import { buttonVariants } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { useCallback, useEffect, useState } from "react";
import { Asset } from "@/components/asset";
import { CommunityDetailScreen } from "@/features/community/community-detail";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import { useGalleries } from "@/features/community/use-galleries";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { ApiError } from "@/lib/api/client";
import {
  getGalleryBans,
  getGalleryModerationLogs,
  getMyGalleryRole,
  liftGalleryBan,
  updateGalleryDescription,
  type GalleryBan,
  type GalleryModerationLog,
} from "@/lib/api/community";
import {
  approveGalleryProposal,
  listGalleryProposals,
  listReports,
  rejectGalleryProposal,
  rejectReport,
  reportActions,
  resolveReport,
  type AdminReport,
  type GalleryProposal,
  type ReportAction,
} from "@/lib/api/admin";

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

/** Cursor list that keeps following `nextCursor` on demand. */
function useCursorList<T>(load: (cursor: number | null) => Promise<{ items: T[]; nextCursor: number | null; hasNext: boolean }>) {
  const [state, setState] = useState<{ items: T[]; cursor: number | null; hasNext: boolean; error?: string; loaded: boolean }>({
    items: [],
    cursor: null,
    hasNext: false,
    loaded: false,
  });
  const [busy, setBusy] = useState(false);
  const fetchPage = useCallback(
    (cursor: number | null, append: boolean) =>
      load(cursor)
        .then((page) =>
          setState((old) => ({
            items: append ? [...old.items, ...page.items] : page.items,
            cursor: page.nextCursor,
            hasNext: page.hasNext,
            loaded: true,
          })),
        )
        .catch((cause) => setState((old) => ({ ...old, loaded: true, error: adminError(cause, "목록을 불러오지 못했습니다.") }))),
    [load],
  );
  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);
  return {
    ...state,
    busy,
    reload: () => fetchPage(null, false),
    more: async () => {
      if (!state.hasNext || busy) return;
      setBusy(true);
      await fetchPage(state.cursor, true);
      setBusy(false);
    },
    remove: (predicate: (item: T) => boolean) => setState((old) => ({ ...old, items: old.items.filter((item) => !predicate(item)) })),
  };
}

function ProposalCard({ proposal, onDone }: { proposal: GalleryProposal; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      onDone();
    } catch (cause) {
      setError(adminError(cause, "신청을 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }
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
        <button disabled={busy || !reason.trim()} onClick={() => void act(() => rejectGalleryProposal(proposal.proposalId, reason.trim()))}>
          반려
        </button>
        <button className={workspaceStyles.workspacePrimary} disabled={busy} onClick={() => void act(() => approveGalleryProposal(proposal.proposalId))}>
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
  const actions = reportActions(report.targetType);
  const [action, setAction] = useState<ReportAction>(actions[0]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await run();
      onDone();
    } catch (cause) {
      setError(adminError(cause, "신고를 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }
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
        <button disabled={busy || !reason.trim()} onClick={() => void act(() => rejectReport(report.reportId, reason.trim()))}>
          신고 반려
        </button>
        <button
          className={workspaceStyles.workspacePrimary}
          disabled={busy || !reason.trim() || (action === "BAN_USER" && !validDays)}
          onClick={() => void act(() => resolveReport(report.reportId, action, reason.trim(), action === "BAN_USER" ? banDays : null))}
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
  const proposals = useCursorList(
    useCallback((cursor: number | null) => listGalleryProposals("PENDING", cursor).then((page) => ({ ...page, items: page.proposals })), []),
  );
  const reports = useCursorList(
    useCallback((cursor: number | null) => listReports("PENDING", cursor).then((page) => ({ ...page, items: page.content })), []),
  );
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

/** Galleries the user can manage, resolved from each gallery's `manage/me` (ownership is not permission). */
function useManageableGalleries(enabled: boolean) {
  const galleries = useGalleries(0);
  const userId = useCurrentUserId();
  const [manageable, setManageable] = useState<{ key: string; ids: Set<number> } | null>(null);
  const list = galleries.status === "ready" ? galleries.galleries : null;
  const key = `${userId}:${list?.map((gallery) => gallery.galleryId).join(",")}`;
  useEffect(() => {
    if (!enabled || !list || userId === null) return;
    let active = true;
    Promise.all(list.map((gallery) => getMyGalleryRole(gallery.galleryId).catch(() => null))).then((roles) => {
      if (active) setManageable({ key, ids: new Set(roles.filter((role) => role?.canManage).map((role) => role!.galleryId)) });
    });
    return () => {
      active = false;
    };
  }, [enabled, key, list, userId]);
  return {
    galleries,
    manageable: manageable?.key === key && list ? list.filter((gallery) => manageable.ids.has(gallery.galleryId)) : null,
  };
}

export function CommunityAdminScreen(props: CommunityAdminProps) {
  const userId = useCurrentUserId();
  const role = useGalleryRole(props.community?.galleryId ?? null);
  const { galleries, manageable } = useManageableGalleries(props.community === null);
  if (userId === null) return <SignInRequired>커뮤니티 관리는 로그인 후 사용할 수 있습니다.</SignInRequired>;
  if (!props.community)
    return (
      <section className={cn(communityStyles.communityAdminStatus, sharedStyles.scrollContent)}>
        <h1>커뮤니티 관리</h1>
        {galleries.status === "error" ? (
          <>
            <p role="alert">커뮤니티를 불러오지 못했습니다.</p>
            <button className={buttonVariants({ tone: "secondary" })} onClick={galleries.refetch}>
              다시 시도
            </button>
          </>
        ) : !manageable ? (
          <p role="status">관리 권한을 확인하는 중...</p>
        ) : manageable.length === 0 ? (
          <p role="status">관리할 수 있는 커뮤니티가 없습니다.</p>
        ) : (
          <ul className={communityStyles.communityCardList}>
            {manageable.map((gallery) => (
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
        <p role="status">관리 권한을 확인하는 중...</p>
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
  const [description, setDescription] = useState(community.description ?? "");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const bans = useCursorList<GalleryBan>(
    useCallback((cursor: number | null) => getGalleryBans(community.galleryId, cursor).then((page) => ({ ...page, items: page.bans })), [community.galleryId]),
  );
  const logs = useCursorList<GalleryModerationLog>(
    useCallback(
      (cursor: number | null) => getGalleryModerationLogs(community.galleryId, cursor).then((page) => ({ ...page, items: page.logs })),
      [community.galleryId],
    ),
  );
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
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setNotice("");
          try {
            await updateGalleryDescription(community.galleryId, description.trim());
            setNotice("커뮤니티 설명을 저장했습니다.");
          } catch (cause) {
            setNotice(adminError(cause, "설명을 저장하지 못했습니다."));
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2>커뮤니티 설명</h2>
        <textarea aria-label="커뮤니티 설명" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
        {notice && <p role="status">{notice}</p>}
        <button className={workspaceStyles.workspacePrimary} disabled={saving}>
          {saving ? "저장 중..." : "설명 저장"}
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
                onClick={async () => {
                  try {
                    await liftGalleryBan(community.galleryId, ban.banId);
                    await bans.reload();
                    await logs.reload();
                  } catch (cause) {
                    setNotice(adminError(cause, "제재를 해제하지 못했습니다."));
                  }
                }}
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

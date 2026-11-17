/**
 * Native screen types of the admin feature; registered in ./index.ts.
 * - `admin-review`: the platform admin page `/admin` (src/features/admin/admin-screens.tsx AdminReviewScreen).
 * - `admin-community`: community management `/communities/manage` (the manageable list) and
 *   `/communities/:id/members`. A community's own page is the social `community-detail` screen.
 */

/** A row's in-flight request and its last error ("" when none). */
export type NativeAdminTask = { busy: boolean; error: string };

/** A cursor list with the web's explicit "더보기" button. */
export type NativeAdminList<T> = {
  /** The first page arrived or failed. */
  loaded: boolean;
  error: string | null;
  items: T[];
  hasMore: boolean;
  /** A next page is loading ("더보기" disabled). */
  appending: boolean;
};

export type NativeAdminProposal = NativeAdminTask & {
  proposalId: number;
  name: string;
  description: string;
  /** "신청자 #12 · 2026. 11. 16. 오후 3:00:00" */
  meta: string;
};

export type NativeReportAction = "DELETE_CONTENT" | "WARN_USER" | "BAN_USER" | "NONE";

export type NativeAdminReport = NativeAdminTask & {
  reportId: number;
  /** "POST #3 · 삭제됨" */
  target: string;
  reason: string;
  description: string | null;
  contentSummary: string | null;
  /** "신고자 A → 대상 B · date" */
  meta: string;
  /** Handling choices for this target type, first is the default. */
  actions: { value: NativeReportAction; label: string }[];
};

export type NativeAdminReview = {
  signedIn: boolean;
  tab: "proposals" | "reports";
  proposals: NativeAdminList<NativeAdminProposal>;
  reports: NativeAdminList<NativeAdminReport>;
};

export type NativeAdminReviewAction =
  | { type: "sign-in" }
  | { type: "tab"; tab: NativeAdminReview["tab"] }
  | { type: "approve"; proposalId: number }
  | { type: "reject"; proposalId: number; reason: string }
  | {
      type: "resolve-report";
      reportId: number;
      action: NativeReportAction;
      reason: string;
      banDays: number | null;
    }
  | { type: "reject-report"; reportId: number; reason: string };

export type NativeAdminBan = {
  banId: number;
  /** "이용정지 · 진행 중" */
  status: string;
  /** "사용자 #12" */
  title: string;
  reason: string;
  /** Start and end dates. */
  period: string;
  active: boolean;
};

export type NativeAdminMembers = {
  type: "members";
  galleryId: number;
  name: string;
  /** The saved description; the field starts from it. */
  description: string;
  saving: boolean;
  notice: string;
  /** A ban lift is in flight. */
  lifting: boolean;
  bans: NativeAdminList<NativeAdminBan>;
  /** title "커뮤니티 어드민 지정", detail "사용자 #12 · 사유" (may be ""), time the full date. */
  logs: NativeAdminList<{ logId: number; title: string; detail: string; time: string }>;
  /** "커뮤니티 어드민": title is the nickname, meta "2026. 11. 17. 지정". Never paged. */
  managers: NativeAdminList<{ userId: number; title: string; meta: string; avatarUrl: string | null }>;
  /** Nickname search for a new community admin; `manager` results show "어드민" instead of "지정". */
  managerSearch: {
    status: "idle" | "loading" | "error" | "ready";
    items: {
      userId: number;
      title: string;
      /** The primary instrument, or "". */
      subtitle: string;
      avatarUrl: string | null;
      manager: boolean;
    }[];
    hasMore: boolean;
    loadingMore: boolean;
  };
  /** A grant or revoke is in flight. */
  managerBusy: boolean;
  managerNotice: string;
};

/** What the management pages show, in the web's order of checks. */
export type NativeAdminCommunity = {
  view:
    | { type: "page-state"; text: string; error: boolean }
    | { type: "sign-in"; text: string }
    | {
        type: "galleries";
        status: "loading" | "error" | "empty" | "ready";
        items: { galleryId: number; name: string }[];
      }
    | { type: "status"; text: string; error: boolean; button: "retry" | "back" | null }
    | NativeAdminMembers;
};

export type NativeAdminCommunityAction =
  | { type: "sign-in" }
  | { type: "retry" }
  /** "돌아가기" of the not-a-manager notice and the members page back button. */
  | { type: "leave" }
  | { type: "select"; galleryId: number }
  | { type: "save-description"; text: string }
  | { type: "lift-ban"; banId: number }
  | { type: "more-bans" }
  | { type: "more-logs" }
  | { type: "search-managers"; keyword: string }
  | { type: "more-manager-search" }
  | { type: "grant-manager"; userId: number }
  | { type: "revoke-manager"; userId: number };

export type AdminScreens = {
  "admin-review": { model: NativeAdminReview; action: NativeAdminReviewAction };
  "admin-community": { model: NativeAdminCommunity; action: NativeAdminCommunityAction };
};

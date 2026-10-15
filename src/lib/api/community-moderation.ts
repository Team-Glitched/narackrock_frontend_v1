import { apiRequest } from './client.ts';
import type { ApiResponse } from './contracts.ts';

export type GalleryRole = { galleryId: number; galleryRole: 'MANAGER' | null; isAdmin: boolean; canManage: boolean };
export type Proposal = { proposalId: number; proposerId: number; name: string; description: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejectionReason: string | null; createdAt: string; reviewedAt: string | null };
export type CursorPage = { nextCursor: number | null; hasNext: boolean };
export type Ban = { banId: number; userId: number; actorId: number; banType: 'SUSPEND' | 'EXPEL'; reason: string; bannedUntil: string | null; liftedAt: string | null; createdAt: string; active: boolean };
export type ModerationLog = { logId: number; actionType: string; actorId: number; targetUserId: number | null; targetId: number | null; reason: string | null; createdAt: string };
export type SearchUser = { userId: number; nickname: string; profileImageUrl: string | null; primaryInstrument: string | null; explanation: string | null };
export type Report = { reportId: number; targetType: 'POST' | 'POST_COMMENT' | 'SHORT' | 'SHORT_COMMENT'; targetId: number; targetDeleted: boolean; reason: string; description: string | null; contentSummary: string | null; reportedAt: string; reportedUser: { userId: number; nickname: string } | null };
export type ReportAction = 'DELETE_CONTENT' | 'BAN_USER' | 'WARN_USER' | 'NONE';
export type ContentKind = 'post' | 'comment';

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;
const manage = (id: number) => `/api/v1/galleries/${id}/manage`;
const proposals = '/api/v1/admin/gallery-proposals';
const reports = '/api/v1/admin/reports';
const query = (cursor: number | null, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ size: '20', ...extra });
  if (cursor !== null) params.set('cursor', String(cursor));
  return params.toString();
};

function requireDuration(days: number | undefined, maximum = Number.MAX_SAFE_INTEGER): number {
  if (days === undefined || !Number.isSafeInteger(days) || days < 1 || days > maximum) {
    throw new RangeError('이용정지 기간을 확인해 주세요.');
  }
  return days;
}

// Dependency injection allows contract tests without a server. Production always uses apiRequest.
export function createModerationApi(request: Request = apiRequest) {
  const get = <T>(path: string) => request<ApiResponse<T>>(path).then(r => r.data);
  const send = <T = void>(path: string, method: string, body?: unknown) => request<ApiResponse<T>>(path, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).then(r => r?.data);
  return {
    role: (id: number) => get<GalleryRole>(`${manage(id)}/me`),
    submit: (name: string, description: string) => send<{ proposalId: number; status: 'PENDING' }>('/api/v1/gallery-proposals', 'POST', { name, description }),
    mine: () => get<Proposal[]>('/api/v1/gallery-proposals/me'),
    proposals: (status: string, cursor: number | null = null) => get<CursorPage & { proposals: Proposal[] }>(`${proposals}?${query(cursor, { status })}`),
    approve: (id: number) => send<{ galleryId: number }>(`${proposals}/${id}/approve`, 'PATCH'),
    reject: (id: number, reason: string) => send(`${proposals}/${id}/reject`, 'PATCH', { reason }),
    update: (id: number, description: string) => send(manage(id), 'PATCH', { description }),
    bans: (id: number, cursor: number | null = null, activeOnly = true) => get<CursorPage & { bans: Ban[] }>(`${manage(id)}/bans?${query(cursor, { activeOnly: String(activeOnly) })}`),
    sanction: (id: number, userId: number, type: 'SUSPEND' | 'EXPEL', reason: string, days?: number) => send<{ banId: number }>(`${manage(id)}/bans`, 'POST', { userId, type, reason, ...(type === 'SUSPEND' ? { durationDays: requireDuration(days, 30) } : {}) }),
    lift: (id: number, banId: number) => send(`${manage(id)}/bans/${banId}/lift`, 'PATCH'),
    logs: (id: number, cursor: number | null = null) => get<CursorPage & { logs: ModerationLog[] }>(`${manage(id)}/logs?${query(cursor)}`),
    deleteContent: (id: number, kind: ContentKind, contentId: number, reason: string) => send(`${manage(id)}/${kind === 'post' ? 'posts' : 'comments'}/${contentId}/delete`, 'PATCH', { reason }),
    report: (kind: ContentKind, id: number, reason: string) => send(`/api/v1/posts/${kind === 'comment' ? 'comments/' : ''}${id}/reports`, 'POST', { reason }),
    searchUsers: (keyword: string, page = 0) => get<{ users: SearchUser[]; totalResultCount: number }>(`/api/v1/users/search?${new URLSearchParams({ keyword, page: String(page), size: '20' })}`),
    reports: (status: string, cursor: number | null = null) => get<CursorPage & { content: Report[] }>(`${reports}?${query(cursor, { status })}`),
    resolveReport: (id: number, actionType: ReportAction, reason: string, days?: number) => send(`${reports}/${id}/resolve`, 'PATCH', { actionType, reason, ...(actionType === 'BAN_USER' ? { banDurationDays: requireDuration(days) } : {}) }),
    rejectReport: (id: number, reason: string) => send(`${reports}/${id}/reject`, 'PATCH', { reason }),
  };
}
export const moderationApi = createModerationApi();

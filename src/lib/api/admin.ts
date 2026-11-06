import { apiRequest } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";

const data = <T>(path: string, init?: RequestInit) => apiRequest<ApiResponse<T>>(path, init).then((r) => r.data);
const cursorQuery = (values: Record<string, string | number | null | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined) params.set(key, String(value));
  return params.toString();
};

export type ProposalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GalleryProposal = {
  proposalId: number;
  proposerId: number;
  name: string;
  description: string | null;
  status: ProposalStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function listGalleryProposals(status: ProposalStatus | null, cursor: number | null, signal?: AbortSignal) {
  return data<{ proposals: GalleryProposal[]; nextCursor: number | null; hasNext: boolean }>(
    `/api/v1/admin/gallery-proposals?${cursorQuery({ status, cursor, size: 20 })}`,
    { signal },
  );
}

export function approveGalleryProposal(proposalId: number) {
  return data<{ proposalId: number; status: ProposalStatus; galleryId: number | null }>(
    `/api/v1/admin/gallery-proposals/${proposalId}/approve`,
    { method: "PATCH" },
  );
}

export function rejectGalleryProposal(proposalId: number, reason: string) {
  return data<{ proposalId: number; status: ProposalStatus }>(`/api/v1/admin/gallery-proposals/${proposalId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export type ReportTargetType = "POST" | "POST_COMMENT" | "SHORT" | "SHORT_COMMENT";
export type ReportUser = { userId: number; nickname: string | null };
export type AdminReport = {
  reportId: number;
  targetType: ReportTargetType;
  targetId: number;
  targetUrl: string | null;
  targetDeleted: boolean;
  reason: string;
  description: string | null;
  reportedAt: string;
  reporter: ReportUser | null;
  reportedUser: ReportUser | null;
  contentSummary: string | null;
};

export function listReports(status: "PENDING" | "RESOLVED" | "REJECTED" | null, cursor: number | null, signal?: AbortSignal) {
  return data<{ content: AdminReport[]; nextCursor: number | null; hasNext: boolean }>(
    `/api/v1/admin/reports?${cursorQuery({ status, cursor, size: 20 })}`,
    { signal },
  );
}

/** Actions the backend use case accepts; HIDE_CONTENT is rejected server-side and SHORT cannot be deleted. */
export type ReportAction = "DELETE_CONTENT" | "WARN_USER" | "BAN_USER" | "NONE";
export function reportActions(targetType: ReportTargetType): ReportAction[] {
  return targetType === "SHORT" ? ["WARN_USER", "BAN_USER", "NONE"] : ["DELETE_CONTENT", "WARN_USER", "BAN_USER", "NONE"];
}

export function resolveReport(reportId: number, actionType: ReportAction, reason: string, banDurationDays: number | null) {
  return data<{ reportId: number; status: string; actionType: string }>(`/api/v1/admin/reports/${reportId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ actionType, reason, banDurationDays }),
  });
}

export function rejectReport(reportId: number, reason: string) {
  return data<unknown>(`/api/v1/admin/reports/${reportId}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

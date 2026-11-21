import { apiRequest } from "./client.ts";

/** All report endpoints take a free-form, non-empty `reason` and an optional `description`. */
function report(path: string, reason: string, description: string | null): Promise<unknown> {
  return apiRequest(path, { method: "POST", body: JSON.stringify({ reason, description }) });
}

export const reportPost = (postId: number, reason: string, description: string | null) =>
  report(`/api/v1/posts/${postId}/reports`, reason, description);

export const reportPostComment = (commentId: number, reason: string, description: string | null) =>
  report(`/api/v1/posts/comments/${commentId}/reports`, reason, description);

export const reportShort = (shortId: number, reason: string, description: string | null) =>
  report(`/api/v1/shorts/${shortId}/reports`, reason, description);

export const reportShortComment = (
  shortId: number,
  commentId: number,
  reason: string,
  description: string | null,
) => report(`/api/v1/shorts/${shortId}/comments/${commentId}/reports`, reason, description);

export const reportOpenSource = (openSourceId: number, reason: string, description: string | null) =>
  report(`/api/v1/sources/${openSourceId}/reports`, reason, description);

export const reportOpenSourceComment = (
  commentId: number,
  reason: string,
  description: string | null,
) => report(`/api/v1/sources/comments/${commentId}/reports`, reason, description);

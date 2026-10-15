import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope, ShortCommentList, ShortsPageDto } from "@/lib/api/contracts";

type ShortReaction = { shortId: number; isLiked?: boolean; isDisliked?: boolean; likeCount?: number; dislikeCount?: number };

export function toggleShortReaction(shortId: number, type: "like" | "dislike"): Promise<ShortReaction> {
  return apiRequest<ApiEnvelope<ShortReaction>>(`/api/v1/shorts/${shortId}/${type}`, { method: "POST" }).then(response => response.data);
}

export function getShortComments(shortId: number): Promise<ShortCommentList> {
  return apiRequest<ApiEnvelope<ShortCommentList>>(`/api/v1/shorts/${shortId}/comments`).then(response => response.data);
}

export function createShortComment(shortId: number, content: string, parentCommentId: number | null): Promise<void> {
  return apiRequest<ApiEnvelope<{ commentId: number }>>(`/api/v1/shorts/${shortId}/comments`, {
    method: "POST", body: JSON.stringify({ content, parentCommentId }),
  }).then(() => undefined);
}

export function updateShortComment(shortId: number, commentId: number, content: string): Promise<void> {
  return apiRequest<ApiEnvelope<unknown>>(`/api/v1/shorts/${shortId}/comments/${commentId}`, {
    method: "PUT", body: JSON.stringify({ content }),
  }).then(() => undefined);
}

export function deleteShortComment(shortId: number, commentId: number): Promise<void> {
  return apiRequest<ApiEnvelope<unknown>>(`/api/v1/shorts/${shortId}/comments/${commentId}`, { method: "DELETE" }).then(() => undefined);
}

export type ShortCommentReaction = { commentId: number; isLiked?: boolean; isDisliked?: boolean; likeCount?: number; dislikeCount?: number };
export function toggleShortCommentReaction(shortId: number, commentId: number, type: "like" | "dislike"): Promise<ShortCommentReaction> {
  return apiRequest<ApiEnvelope<ShortCommentReaction>>(`/api/v1/shorts/${shortId}/comments/${commentId}/${type}s`, { method: "POST" }).then(response => response.data);
}

export async function getShorts(cursor?: number, signal?: AbortSignal): Promise<ShortsPageDto> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(`/api/v1/shorts${query}`, {
    signal,
    credentials: "omit",
  });
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getPopularShorts(size = 10, signal?: AbortSignal): Promise<ShortsPageDto> {
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(
    `/api/v1/shorts/popular?size=${encodeURIComponent(size)}`,
    { signal, credentials: "omit" },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getMyShorts(size = 10, signal?: AbortSignal): Promise<ShortsPageDto> {
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(
    `/api/v1/shorts/mine?size=${encodeURIComponent(size)}`,
    { signal, credentials: "omit" },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

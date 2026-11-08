import { apiRequest } from "./client.ts";
import { getDeviceId } from "./device-id.ts";
import type { ApiEnvelope, ContentViewResponse, ShortItemDto, ShortsPageDto } from "./contracts.ts";
import type { TrackDto } from "./composition.ts";

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(path, init);
  return response.data;
}

export function getShorts(cursor?: number, signal?: AbortSignal): Promise<ShortsPageDto> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return data(`/api/v1/shorts${query}`, { signal });
}

export function searchShorts(keyword: string, cursor?: number, signal?: AbortSignal): Promise<ShortsPageDto> {
  const query = new URLSearchParams({ keyword });
  if (cursor !== undefined) query.set("cursor", String(cursor));
  return data(`/api/v1/shorts/search?${query}`, { signal });
}

export function getPopularShorts(size = 10, signal?: AbortSignal): Promise<ShortsPageDto> {
  return data(`/api/v1/shorts/popular?size=${encodeURIComponent(size)}`, { signal });
}

export function getMyShorts(
  query: { cursor?: number; size?: number } = {},
  signal?: AbortSignal,
): Promise<ShortsPageDto> {
  const params = new URLSearchParams({ size: String(query.size ?? 20) });
  if (query.cursor !== undefined) params.set("cursor", String(query.cursor));
  return data(`/api/v1/shorts/mine?${params}`, { signal });
}

/** One short by ID, so shared/saved deep links never scan the feed. */
export function getShort(shortId: number, signal?: AbortSignal): Promise<ShortItemDto> {
  return data(`/api/v1/shorts/${shortId}`, { signal });
}

/** The response carries only the requested side; callers re-read the short to reconcile the other side. */
export function reactToShort(shortId: number, kind: "like" | "dislike"): Promise<unknown> {
  return data(`/api/v1/shorts/${shortId}/${kind}`, { method: "POST" });
}

export function toggleShortBookmark(shortId: number): Promise<{ shortId: number; isBookmarked: boolean }> {
  return data(`/api/v1/shorts/${shortId}/bookmark`, { method: "POST" });
}

export function getShortShareLink(shortId: number): Promise<{ shortId: number; shareUrl: string }> {
  return data(`/api/v1/shorts/${shortId}/share`, { method: "POST" });
}

/** Signed-in viewers are identified by the session, anonymous ones by the persistent device ID. */
export function recordShortView(shortId: number): Promise<ContentViewResponse> {
  return data(`/api/v1/shorts/${shortId}/views`, { method: "POST", headers: { "X-Device-Id": getDeviceId() } });
}

/** Sent only on a user's play/pause action, never on a timer. */
export function toggleShortPlayback(
  shortId: number,
  isPlaying: boolean,
  currentTime: number,
): Promise<{ shortId: number; isPlaying: boolean; pausedAt: number; timestamp: string }> {
  return data(`/api/v1/shorts/${shortId}/playback/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ isPlaying, currentTime }),
  });
}

export type ShortComposer = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  description: string | null;
};

export function getShortComposers(shortId: number, signal?: AbortSignal): Promise<ShortComposer[]> {
  return data(`/api/v1/shorts/${shortId}/composers`, { signal });
}

export type ShortParticipantTracks = {
  shortId: number;
  project: { bpm: number; ppq: number; maxDurationMs: number };
  tracks: TrackDto[];
};

/** Approved tracks/clips only; requires a session. */
export function getShortParticipantTracks(shortId: number, signal?: AbortSignal): Promise<ShortParticipantTracks> {
  return data(`/api/v1/shorts/${shortId}/participant-tracks`, { signal });
}

export type ShortComment = {
  commentId: number;
  parentCommentId: number | null;
  content: string;
  writer: { userId: number; nickname: string | null; profileImageUrl: string | null };
  likeCount: number;
  dislikeCount: number;
  replyCount: number;
  isLiked: boolean;
  isDisliked: boolean;
  createdAt: string;
};

/** The short comment list is not paged; it returns every top-level comment and reply. */
export function getShortComments(
  shortId: number,
  signal?: AbortSignal,
): Promise<{ shortId: number; comments: ShortComment[] }> {
  return data(`/api/v1/shorts/${shortId}/comments`, { signal });
}

export function createShortComment(shortId: number, content: string, parentCommentId: number | null): Promise<unknown> {
  return data(`/api/v1/shorts/${shortId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentCommentId }),
  });
}

export function updateShortComment(shortId: number, commentId: number, content: string): Promise<unknown> {
  return data(`/api/v1/shorts/${shortId}/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ content }) });
}

export function deleteShortComment(shortId: number, commentId: number): Promise<unknown> {
  return apiRequest(`/api/v1/shorts/${shortId}/comments/${commentId}`, { method: "DELETE" });
}

export function likeShortComment(shortId: number, commentId: number): Promise<{ isLiked: boolean; likeCount: number }> {
  return data(`/api/v1/shorts/${shortId}/comments/${commentId}/likes`, { method: "POST" });
}

export function dislikeShortComment(
  shortId: number,
  commentId: number,
): Promise<{ isDisliked: boolean; dislikeCount: number }> {
  return data(`/api/v1/shorts/${shortId}/comments/${commentId}/dislikes`, { method: "POST" });
}

import { sanitizeSingleLine } from "../content-limits.ts";
import { apiRequest } from "./client.ts";
import type { ApiResponse, ContentViewResponse } from "./contracts.ts";

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest<ApiResponse<T>>(path, init);
  return response.data;
}

export type OpenSourceWriter = { userId: number; nickname: string; profileImageUrl: string | null };

export type OpenSourceMidiNote = {
  pitch: number;
  startTick: number;
  durationTick: number;
  velocity: number;
};

/** `GET /api/v1/open-sources` item. A null usageCount means usage is not tracked. */
export type OpenSourceSummary = {
  instrument?: string | null;
  hasMidiNotes?: boolean;
  openSourceId: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  writer: OpenSourceWriter;
  usageCount: number | null;
  canPreview?: boolean;
  isSaved: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
};

/** Flat detail: summary fields plus preview availability. durationMs may be null. */
export type OpenSourceDetail = OpenSourceSummary & {
  canPreview: boolean;
  durationMs: number | null;
  midiPpq?: number | null;
  midiBpm?: number | null;
  midiNotes?: OpenSourceMidiNote[] | null;
};

export type OpenSourcePage<T> = { page: number; size: number; hasNext: boolean; items: T[] };

export type SavedOpenSource = {
  openSourceId: number;
  savedAt: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
  source: OpenSourceSummary | null;
};

export type OpenSourcePublication = {
  instrument?: string | null;
  hasMidiNotes?: boolean;
  openSourceId: number;
  ownerId: number;
  title: string;
  description: string | null;
  mediaFileId: number;
  thumbnailMediaFileId: number | null;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt: string;
};

export type OpenSourcePlayback = {
  openSourceId: number;
  audioUrl: string;
  mimeType: string;
  durationMs: number | null;
  expiresAt: string;
};

export type OpenSourceReaction = {
  isLiked: boolean;
  isDisliked: boolean;
  likeCount: number;
  dislikeCount: number;
};

export type OpenSourceComment = {
  commentId: number;
  parentCommentId: number | null;
  writer: OpenSourceWriter;
  content: string;
  replyCount: number;
  isLiked: boolean;
  isDisliked: boolean;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
};

export type OpenSourceCommentPage = {
  openSourceId: number;
  parentCommentId: number | null;
  page: number;
  size: number;
  totalCount: number;
  hasNext: boolean;
  comments: OpenSourceComment[];
};

export function updateOpenSourceComment(commentId: number, content: string): Promise<{ commentId: number }> {
  return data(`/api/v1/sources/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function deleteOpenSourceComment(commentId: number): Promise<void> {
  await apiRequest<ApiResponse<void>>(`/api/v1/sources/comments/${commentId}`, { method: "DELETE" });
}

const query = (values: Record<string, string | number | null | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
};

export function listOpenSources(
  options: { keyword?: string; page?: number; size?: number },
  signal?: AbortSignal,
): Promise<OpenSourcePage<OpenSourceSummary>> {
  return data(
    `/api/v1/sources${query({ keyword: options.keyword ? sanitizeSingleLine(options.keyword) : undefined, page: options.page ?? 0, size: options.size ?? 20 })}`,
    { signal },
  );
}

export function getOpenSource(id: number, signal?: AbortSignal): Promise<OpenSourceDetail> {
  return data(`/api/v1/sources/${id}`, { signal });
}

export function listPopularOpenSources(size: number, signal?: AbortSignal): Promise<OpenSourcePage<OpenSourceSummary>> {
  return data(`/api/v1/sources/popular${query({ size })}`, { signal });
}

export function recordOpenSourceView(id: number): Promise<ContentViewResponse> {
  return data(`/api/v1/sources/${id}/views`, { method: "POST" });
}

export function listSavedOpenSources(page: number, signal?: AbortSignal): Promise<OpenSourcePage<SavedOpenSource>> {
  return data(`/api/v1/users/me/sources${query({ page, size: 50 })}`, { signal });
}

/** Follows the saved-source pagination to the end. */
export async function listAllSavedOpenSources(signal?: AbortSignal): Promise<SavedOpenSource[]> {
  const items: SavedOpenSource[] = [];
  for (let page = 0; ; page++) {
    const result = await listSavedOpenSources(page, signal);
    items.push(...result.items);
    if (!result.hasNext) return items;
  }
}

export function setOpenSourceSaved(id: number, saved: boolean): Promise<{ openSourceId: number; isSaved: boolean }> {
  return data(`/api/v1/sources/${id}/save`, { method: saved ? "PUT" : "DELETE" });
}

export function getOpenSourcePlayback(id: number): Promise<OpenSourcePlayback> {
  return data(`/api/v1/sources/${id}/playback`);
}

export function getOpenSourceShare(id: number): Promise<{ openSourceId: number; shareUrl: string }> {
  return data(`/api/v1/sources/${id}/share`);
}

export function reactToOpenSource(id: number, kind: "like" | "dislike"): Promise<OpenSourceReaction> {
  return data(`/api/v1/sources/${id}/${kind === "like" ? "likes" : "dislikes"}`, { method: "POST" });
}

export function getOpenSourceComments(
  id: number,
  parentCommentId: number | null,
  page: number,
  signal?: AbortSignal,
): Promise<OpenSourceCommentPage> {
  return data(`/api/v1/sources/${id}/comments${query({ parentCommentId, page })}`, { signal });
}

export function createOpenSourceComment(
  id: number,
  content: string,
  parentCommentId: number | null,
): Promise<{ openSourceId: number; commentCount: number; comment: OpenSourceComment }> {
  return data(`/api/v1/sources/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentCommentId }),
  });
}

export function reactToOpenSourceComment(commentId: number, kind: "like" | "dislike"): Promise<OpenSourceReaction> {
  return data(`/api/v1/sources/comments/${commentId}/${kind === "like" ? "likes" : "dislikes"}`, {
    method: "POST",
  });
}

/** Creates a PRIVATE publication from the caller's READY audio. */
export function createOpenSource(body: {
  instrument?: string | null;
  title: string;
  description: string | null;
  mediaFileId: number;
  thumbnailMediaFileId: number | null;
  midiPpq?: number | null;
  midiBpm?: number | null;
  midiNotes?: OpenSourceMidiNote[] | null;
}): Promise<OpenSourcePublication> {
  return data("/api/v1/sources", { method: "POST", body: JSON.stringify(body) });
}

/** Omitted fields are kept; null description/thumbnail removes them. */
export function updateOpenSource(
  id: number,
  patch: { title?: string; description?: string | null; thumbnailMediaFileId?: number | null; instrument?: string | null },
): Promise<OpenSourcePublication> {
  return data(`/api/v1/sources/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function setOpenSourceVisibility(
  id: number,
  visibility: "PRIVATE" | "PUBLIC",
): Promise<{ openSourceId: number; visibility: "PRIVATE" | "PUBLIC" }> {
  return data(`/api/v1/sources/${id}/visibility`, { method: "PUT", body: JSON.stringify({ visibility }) });
}

export function getMyOpenSourcePublication(id: number): Promise<OpenSourcePublication> {
  return data(`/api/v1/users/me/source-publications/${id}`);
}

export function listMyOpenSourcePublications(page: number, signal?: AbortSignal): Promise<OpenSourcePage<OpenSourcePublication>> {
  return data(`/api/v1/users/me/source-publications${query({ page, size: 50 })}`, { signal });
}

export function deleteOpenSource(id: number): Promise<{ openSourceId: number; isDeleted: boolean }> {
  return data(`/api/v1/sources/${id}`, { method: "DELETE" });
}

export async function hideOpenSourceComment(commentId: number, signal?: AbortSignal): Promise<void> {
  await apiRequest<void>(`/api/v1/sources/comments/${commentId}/hidden`, { method: "PUT", signal });
}

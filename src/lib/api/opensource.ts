import { apiRequest } from './client.ts';
import type { ApiEnvelope } from './contracts.ts';

export type OpenSourceWriter = { userId: number; nickname: string; profileImageUrl: string | null };
export type OpenSourceReaction = { isLiked: boolean; isDisliked: boolean; likeCount: number; dislikeCount: number };
export type OpenSourceItem = OpenSourceReaction & { openSourceId: number; title: string; description: string | null; thumbnailUrl: string | null; writer: OpenSourceWriter; usageCount: number; isSaved: boolean; commentCount: number; createdAt: string };
export type OpenSourceDetail = OpenSourceItem & { canPreview: boolean; durationMs: number | null };
export type OpenSourcePage<T> = { page: number; size: number; hasNext: boolean; items: T[] };
export type SavedOpenSource = { openSourceId: number; savedAt: string } & ({ availability: 'AVAILABLE'; source: OpenSourceItem } | { availability: 'UNAVAILABLE'; source: null });
export type OpenSourceComment = OpenSourceReaction & { commentId: number; parentCommentId: number | null; writer: OpenSourceWriter; content: string; replyCount: number; createdAt: string };
export type OpenSourcePublication = { openSourceId: number; ownerId: number; title: string; description: string | null; mediaFileId: number; thumbnailMediaFileId: number | null; visibility: 'PRIVATE' | 'PUBLIC'; createdAt: string; updatedAt: string };
export type PublicationInput = { title: string; description?: string | null; mediaFileId: number; thumbnailMediaFileId?: number | null };
const base = '/api/v1/open-sources';
async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(path, init);
  if (!response.success) throw new Error(response.message);
  return response.data;
}
const body = (method: string, value: unknown): RequestInit => ({ method, body: JSON.stringify(value) });
export const openSourceApi = {
  list: (keyword = '', page = 0, signal?: AbortSignal) => data<OpenSourcePage<OpenSourceItem>>(`${base}?${new URLSearchParams({ keyword, page: String(page), size: '20' })}`, { signal }),
  detail: (id: number, signal?: AbortSignal) => data<OpenSourceDetail>(`${base}/${id}`, { signal }),
  saved: (page = 0) => data<OpenSourcePage<SavedOpenSource>>(`/api/v1/users/me/open-sources?page=${page}&size=20`),
  save: (id: number, saved: boolean) => data<{ openSourceId: number; isSaved: boolean }>(`${base}/${id}/save`, { method: saved ? 'PUT' : 'DELETE' }),
  react: (id: number, vote: 'likes' | 'dislikes') => data<OpenSourceReaction & { openSourceId: number }>(`${base}/${id}/${vote}`, { method: 'POST' }),
  comments: (id: number, page = 0, parentCommentId?: number) => data<{ openSourceId: number; parentCommentId: number | null; page: number; size: number; totalCount: number; hasNext: boolean; comments: OpenSourceComment[] }>(`${base}/${id}/comments?page=${page}${parentCommentId == null ? '' : `&parentCommentId=${parentCommentId}`}`),
  comment: (id: number, content: string, parentCommentId?: number) => data<{ openSourceId: number; commentCount: number; comment: OpenSourceComment }>(`${base}/${id}/comments`, body('POST', { content, parentCommentId })),
  reactComment: (id: number, vote: 'likes' | 'dislikes') => data<OpenSourceReaction & { commentId: number }>(`${base}/comments/${id}/${vote}`, { method: 'POST' }),
  playback: (id: number) => data<{ openSourceId: number; audioUrl: string; mimeType: string; durationMs: number | null; expiresAt: string }>(`${base}/${id}/playback`),
  share: (id: number) => data<{ openSourceId: number; shareUrl: string }>(`${base}/${id}/share`),
  publications: (page = 0) => data<OpenSourcePage<OpenSourcePublication>>(`/api/v1/users/me/open-source-publications?page=${page}&size=20`),
  publication: (id: number) => data<OpenSourcePublication>(`/api/v1/users/me/open-source-publications/${id}`),
  create: (input: PublicationInput) => data<OpenSourcePublication>(base, body('POST', input)),
  update: (id: number, input: Partial<Omit<PublicationInput, 'mediaFileId'>>) => data<OpenSourcePublication>(`${base}/${id}`, body('PATCH', input)),
  visibility: (id: number, visibility: 'PRIVATE' | 'PUBLIC') => data<{ openSourceId: number; visibility: 'PRIVATE' | 'PUBLIC' }>(`${base}/${id}/visibility`, body('PUT', { visibility })),
  remove: (id: number) => data<{ openSourceId: number; isDeleted: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
};

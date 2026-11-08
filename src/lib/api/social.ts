import { apiOrigin, apiRequest } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";

export type Person = { userId: number; nickname: string; profileImageUrl: string | null; primaryInstrument: string | null };
export type RecommendedPerson = Person & {
  recommendType: "COLLABORATOR" | "FRIEND_OF_FRIEND" | "POPULAR_CREATOR";
  explanation: string | null;
  isFollowing: boolean;
};
export type SearchedPerson = Person & { explanation: string | null; isFollowing: boolean };
export type FollowRequest = {
  requestId: number;
  requesterId: number;
  nickname: string;
  primaryInstrument: string | null;
  profileImageUrl: string | null;
};
export type OutgoingRequest = { id: number; requesterId: number; targetId: number };
export type ChatMessage = { id: number; senderId: number; recipientId: number; content: string; createdAt: string };
export type ChatThread = Person & { lastMessageId: number; lastMessage: string; lastMessageAt: string; outgoing: boolean };

/** STOMP endpoint on the configured backend origin (ws/wss derived from http/https). */
export function chatWebSocketUrl(): string {
  return `${apiOrigin().replace(/^http/, "ws")}/ws/chat`;
}

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiRequest<ApiResponse<T>>(path, init)).data;
}

export const getMutualFollowers = (signal?: AbortSignal) => data<Person[]>("/api/v1/users/me/mutual", { signal });
/** Rejects with 403/PRIVATE_PROFILE for another user's private profile; that is not an empty list. */
export const getRelations = (userId: number, type: "followers" | "following", signal?: AbortSignal) =>
  data<Person[]>(`/api/v1/users/${userId}/relations?type=${type}`, { signal });
export const getRecommendations = (page = 0, size = 20, signal?: AbortSignal) =>
  data<{ totalCount: number; fallbackTriggered: boolean; recommendedUsers: RecommendedPerson[] }>(
    `/api/v1/users/recommendations?page=${page}&size=${size}`,
    { signal },
  );
export const searchPeople = (keyword: string, page = 0, size = 20, signal?: AbortSignal) =>
  data<{ searchKeyword: string; totalResultCount: number; users: SearchedPerson[] }>(
    `/api/v1/users/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`,
    { signal },
  );
export const getFollowRequests = (signal?: AbortSignal) => data<FollowRequest[]>("/api/v1/users/me/follow-requests", { signal });
export const getOutgoingFollowRequests = (signal?: AbortSignal) =>
  data<OutgoingRequest[]>("/api/v1/users/me/follow-requests/outgoing", { signal });
/** Public targets are followed immediately; private targets get a PENDING request. */
export const followPerson = (userId: number) =>
  data<{ status: "FOLLOWING" | "PENDING"; requestId: number | null }>(`/api/v1/users/${userId}/follow`, { method: "POST" });
/** Unfollows, or cancels the caller's pending request to that user. */
export const unfollowPerson = (userId: number) => data<unknown>(`/api/v1/users/${userId}/follow`, { method: "DELETE" });
export const reviewFollowRequest = (requestId: number, decision: "accept" | "reject") =>
  data<number>(`/api/v1/users/me/follow-requests/${requestId}/${decision}`, { method: "POST" });
export const updateProfilePrivacy = (isPrivate: boolean) =>
  data<{ isPrivate: boolean }>("/api/v1/users/me/profile/privacy", { method: "PATCH", body: JSON.stringify({ isPrivate }) });

export const getChatThreads = () => data<ChatThread[]>("/api/v1/chats");
export const getChatMessages = (friendId: number, beforeId?: number) =>
  data<ChatMessage[]>(`/api/v1/chats/${friendId}/messages?size=50${beforeId === undefined ? "" : `&beforeId=${beforeId}`}`);
export const sendChatMessage = (friendId: number, content: string) =>
  data<ChatMessage>(`/api/v1/chats/${friendId}/messages`, { method: "POST", body: JSON.stringify({ content }) });

import { apiRequest } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";

export type Person = { userId: number; nickname: string; profileImageUrl: string | null; primaryInstrument: string | null };
export type RecommendedPerson = Person & { recommendType: "COLLABORATOR" | "FRIEND_OF_FRIEND" | "POPULAR_CREATOR"; explanation: string; isFollowing: boolean };
export type FollowRequest = { requestId: number; requesterId: number; nickname: string; primaryInstrument: string | null; profileImageUrl: string | null };
export type OutgoingRequest = { id: number; requesterId: number; targetId: number };
export type ChatMessage = { id: number; senderId: number; recipientId: number; content: string; createdAt: string };
export type ChatThread = Person & { lastMessageId: number; lastMessage: string; lastMessageAt: string; outgoing: boolean };

export function chatWebSocketUrl(): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin).replace(/\/$/, "");
  return `${base.replace(/^http/, "ws")}/ws/chat`;
}

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiRequest<ApiResponse<T>>(path, init)).data;
}

export const getMutualFollowers = () => data<Person[]>("/api/v1/users/me/mutual");
export const getFollowers = (userId: number) => data<Person[]>(`/api/v1/users/${userId}/relations?type=followers`);
export const getFollowing = (userId: number) => data<Person[]>(`/api/v1/users/${userId}/relations?type=following`);
export const getRecommendations = (page = 0, size = 20) => data<{ totalCount: number; recommendedUsers: RecommendedPerson[] }>(`/api/v1/users/recommendations?page=${page}&size=${size}`);
export const getFollowRequests = () => data<FollowRequest[]>("/api/v1/users/me/follow-requests");
export const getOutgoingFollowRequests = () => data<OutgoingRequest[]>("/api/v1/users/me/follow-requests/outgoing");
export const followPerson = (userId: number) => data<{ status: "FOLLOWING" | "PENDING"; requestId: number | null }>(`/api/v1/users/${userId}/follow`, { method: "POST" });
export const unfollowPerson = (userId: number) => data<unknown>(`/api/v1/users/${userId}/follow`, { method: "DELETE" });
export const reviewFollowRequest = (requestId: number, decision: "accept" | "reject") => data<number>(`/api/v1/users/me/follow-requests/${requestId}/${decision}`, { method: "POST" });
export const getChatMessages = (friendId: number) => data<ChatMessage[]>(`/api/v1/chats/${friendId}/messages`);
export const getChatThreads = () => data<ChatThread[]>("/api/v1/chats");
export const sendChatMessage = (friendId: number, content: string) => data<ChatMessage>(`/api/v1/chats/${friendId}/messages`, { method: "POST", body: JSON.stringify({ content }) });

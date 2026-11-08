import { apiRequest } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";
export const notificationCategories = [
  ["FOLLOW", "팔로우"], ["CONTRIBUTION", "작곡"], ["COMMUNITY", "커뮤니티"],
  ["SHORT", "음악"], ["OPEN_SOURCE", "오픈소스"], ["SYSTEM", "운영 안내"],
] as const;
export type NotificationCategory = (typeof notificationCategories)[number][0];
export type ServiceNotification = {
  id: number; type: string; category: NotificationCategory; actorId: number | null;
  title: string; body: string; path: string | null; createdAt: string; readAt: string | null;
  available: boolean; projectId: number | null; requestId: number | null; requestStatus: string | null;
};
export type NotificationPage = { items: ServiceNotification[]; nextCursor: number | null; unreadCount: number; throughId: number | null };
export type NotificationPreferences = { reactions: boolean; followingContent: boolean; communityPosts: boolean; sourceUsage: boolean };
async function data<T>(path: string, init?: RequestInit) {
  return (await apiRequest<ApiResponse<T>>(path, init)).data;
}
export function getNotifications(cursor: number | undefined, category: NotificationCategory | null, unreadOnly: boolean, signal?: AbortSignal) {
  const query = new URLSearchParams({ size: "30", unreadOnly: String(unreadOnly) });
  if (cursor !== undefined) query.set("cursor", String(cursor));
  if (category) query.set("category", category);
  return data<NotificationPage>(`/api/v1/notifications?${query}`, { signal });
}
export const getUnreadNotifications = (signal?: AbortSignal) => data<{ count: number }>("/api/v1/notifications/unread-count", { signal });
export const readNotification = (id: number) => data<void>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
export const readAllNotifications = (throughId: number) => data<void>("/api/v1/notifications/read-all", { method: "PATCH", body: JSON.stringify({ throughId }) });
export const getNotificationPreferences = () => data<NotificationPreferences>("/api/v1/notifications/preferences");
export const setNotificationPreferences = (values: NotificationPreferences) => data<NotificationPreferences>("/api/v1/notifications/preferences", { method: "PUT", body: JSON.stringify(values) });

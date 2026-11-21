import { ApiError, apiRequest, getCurrentUserId } from "./client.ts";
import type { ApiResponse } from "./contracts.ts";
export const notificationCategories = [
  ["FOLLOW", "팔로우"],
  ["CONTRIBUTION", "작곡"],
  ["COMMUNITY", "커뮤니티"],
  ["SHORT", "음악"],
  ["OPEN_SOURCE", "샘플"],
  ["SYSTEM", "운영 안내"],
] as const;
export type NotificationCategory = (typeof notificationCategories)[number][0];
export type ServiceNotification = {
  id: number;
  type: string;
  category: NotificationCategory;
  actorId: number | null;
  title: string;
  body: string;
  path: string | null;
  createdAt: string;
  readAt: string | null;
  available: boolean;
  projectId: number | null;
  requestId: number | null;
  requestStatus: string | null;
};
export type NotificationPage = {
  items: ServiceNotification[];
  nextCursor: number | null;
  unreadCount: number;
  throughId: number | null;
};
export type NotificationPreferences = {
  reactions: boolean;
  followingContent: boolean;
  communityPosts: boolean;
  sourceUsage: boolean;
};
async function data<T>(path: string, init?: RequestInit) {
  return (await apiRequest<ApiResponse<T>>(path, init)).data;
}
export function getNotifications(
  cursor: number | undefined,
  category: NotificationCategory | null,
  unreadOnly: boolean,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ size: "30", unreadOnly: String(unreadOnly) });
  if (cursor !== undefined) query.set("cursor", String(cursor));
  if (category) query.set("category", category);
  return data<NotificationPage>(`/api/v1/notifications?${query}`, { signal });
}
export const getUnreadNotifications = (signal?: AbortSignal) =>
  data<{ count: number }>("/api/v1/notifications/unread-count", { signal });
export const readNotification = (id: number) =>
  data<void>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
export const readAllNotifications = (throughId: number) =>
  data<void>("/api/v1/notifications/read-all", {
    method: "PATCH",
    body: JSON.stringify({ throughId }),
  });
async function deleteNotificationEndpoint(path: string, unavailableMessage: string): Promise<void> {
  try {
    await apiRequest<ApiResponse<void> | undefined>(path, { method: "DELETE" });
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
    if (cause.status === 401 && getCurrentUserId() !== null) {
      // Older servers can secure the error dispatch for a missing DELETE route with a 401.
      // Only replace that message when another protected endpoint confirms the session is valid.
      await getUnreadNotifications();
    } else if (cause.status !== 404 && cause.status !== 405) {
      throw cause;
    }
    throw new ApiError(503, unavailableMessage, "NOTIFICATION_DELETE_UNAVAILABLE");
  }
}
export function deleteReadNotifications(): Promise<void> {
  return deleteNotificationEndpoint(
    "/api/v1/notifications/read",
    "현재 서버에서 읽은 알림 삭제 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  );
}
export function deleteNotification(id: number): Promise<void> {
  return deleteNotificationEndpoint(
    `/api/v1/notifications/${id}`,
    "현재 서버에서 알림 삭제 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  );
}

/** A grouped row must finish every deletion before its list is refreshed, including partial failures. */
export async function deleteNotifications(ids: number[]): Promise<void> {
  const results = await Promise.allSettled(ids.map(deleteNotification));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
export const getNotificationPreferences = () =>
  data<NotificationPreferences>("/api/v1/notifications/preferences");
export const setNotificationPreferences = (values: NotificationPreferences) =>
  data<NotificationPreferences>("/api/v1/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(values),
  });

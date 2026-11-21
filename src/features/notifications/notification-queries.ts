import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { queryScope } from "@/lib/query";
import {
  getNotifications,
  getUnreadNotifications,
  readNotification,
  readAllNotifications,
  deleteNotification,
  deleteReadNotifications,
  getNotificationPreferences,
  setNotificationPreferences,
  type NotificationCategory,
} from "@/lib/api/notifications";
export const notificationKeys = {
  all: (user: number | null) => [...queryScope(user), "notifications"] as const,
  unread: (user: number | null) => [...notificationKeys.all(user), "unread"] as const,
  preferences: (user: number | null) => [...notificationKeys.all(user), "preferences"] as const,
};
export const unreadNotificationsQuery = (user: number | null) =>
  queryOptions({
    queryKey: notificationKeys.unread(user),
    queryFn: ({ signal }) => getUnreadNotifications(signal),
    enabled: user !== null,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
export const notificationsQuery = (
  user: number | null,
  category: NotificationCategory | null,
  unread: boolean,
) =>
  infiniteQueryOptions({
    queryKey: [...notificationKeys.all(user), "list", category, unread],
    queryFn: ({ pageParam, signal }) => getNotifications(pageParam, category, unread, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: user !== null,
    // Keep an open inbox current even when STOMP cannot connect or misses an event.
    refetchInterval: 20_000,
  });
export const notificationPreferencesQuery = (user: number | null) =>
  queryOptions({
    queryKey: notificationKeys.preferences(user),
    queryFn: getNotificationPreferences,
    enabled: user !== null,
  });
export function useNotificationMutations() {
  const user = useCurrentUserId(),
    client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: notificationKeys.all(user) });
  return {
    read: useMutation({
      mutationFn: (ids: number[]) => Promise.all(ids.map(readNotification)),
      onSuccess: refresh,
    }),
    readAll: useMutation({ mutationFn: readAllNotifications, onSuccess: refresh }),
    deleteOne: useMutation({
      mutationFn: (ids: number[]) => Promise.all(ids.map(deleteNotification)),
      onSuccess: refresh,
    }),
    deleteRead: useMutation({ mutationFn: deleteReadNotifications, onSuccess: refresh }),
    preferences: useMutation({ mutationFn: setNotificationPreferences, onSuccess: refresh }),
    refresh,
  };
}

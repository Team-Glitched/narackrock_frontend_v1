import { Client } from "@stomp/stompjs";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import {
  apiOrigin,
  getAccessToken,
  getCurrentUserId,
  subscribeCurrentUserId,
} from "@/lib/api/client";
import { chatWebSocketUrl } from "@/lib/api/social";
import { notificationKeys, unreadNotificationsQuery } from "./notification-queries";
/** This connection subscribes only to service notifications. Chat delivery is independent. */
export function NotificationRuntime() {
  const user = useCurrentUserId(),
    queryClient = useQueryClient();
  const origin = apiOrigin();
  useQuery(unreadNotificationsQuery(user));
  useEffect(() => {
    if (user === null) return;
    let active = true;
    const current = () => active && getCurrentUserId() === user && apiOrigin() === origin;
    const refresh = () => {
      if (current()) void queryClient.invalidateQueries({ queryKey: notificationKeys.all(user) });
    };
    const client = new Client({
      brokerURL: chatWebSocketUrl(),
      reconnectDelay: 5000,
      beforeConnect: (connection) => {
        if (!current()) {
          void connection.deactivate();
          return;
        }
        connection.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` };
      },
      onConnect: () => {
        if (!current()) return;
        client.subscribe("/user/queue/notifications", refresh);
        refresh();
      },
    });
    const unsubscribe = subscribeCurrentUserId(() => {
      if (getCurrentUserId() !== user) {
        active = false;
        void client.deactivate();
      }
    });
    client.activate();
    return () => {
      active = false;
      unsubscribe();
      void client.deactivate();
    };
  }, [user, origin, queryClient]);
  return null;
}

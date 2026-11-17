import { useEffect } from "react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/features/auth/auth-session";
import { unreadNotificationsQuery } from "@/features/notifications/notification-queries";
import { unreadChatQuery } from "@/features/social/chat-queries";
import { nativeApp, requestNative } from "@/lib/native-app";

/**
 * Reports navigation availability and the session to native views. No-op in browsers.
 */
export function useNativeReports() {
  const inApp = nativeApp() !== null;
  const { key } = useLocation();
  const { currentUserId: userId, headerProfileImageUrl } = useAuthSession();
  // The header's own queries; enabled only in the app, where no web header shows the badges.
  const notifications = useQuery({
    ...unreadNotificationsQuery(userId),
    enabled: inApp && userId !== null,
  });
  const chats = useQuery({ ...unreadChatQuery(userId), enabled: inApp && userId !== null });
  const unreadNotifications = userId === null ? 0 : (notifications.data?.count ?? 0);
  const unreadChats = userId === null ? 0 : (chats.data?.count ?? 0);

  useEffect(() => {
    // react-router keeps the entry's position in history.state; 0 is where this app session started.
    if (inApp)
      void requestNative("set-history", { canGoBack: (window.history.state?.idx ?? 0) > 0 });
  }, [inApp, key]);
  useEffect(() => {
    if (inApp)
      void requestNative("set-session", {
        session: {
          userId,
          profileImageUrl: headerProfileImageUrl,
          unreadNotifications,
          unreadChats,
        },
      });
  }, [inApp, userId, headerProfileImageUrl, unreadNotifications, unreadChats]);
}

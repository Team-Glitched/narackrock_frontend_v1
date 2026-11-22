import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { requestAge } from "@/features/workspace/contribution-presentation";
import { notificationCategories, type NotificationCategory } from "@/lib/api/notifications";
import type { NativeNotificationPreferences, NativeNotifications } from "@/lib/native-screens";
import { notificationBody } from "./notification-groups";
import { useNotificationPanelNavigation } from "./notification-panel";
import { notificationPreferenceOptions, useNotificationPreferences } from "./notification-settings";
import {
  notificationRowState,
  notificationStatusLabel,
  useNotificationInbox,
} from "./notifications-screen";

const categories = [
  { id: null, label: "전체" },
  ...notificationCategories.map(([id, label]) => ({ id, label })),
];

/** Minute clock for the relative times, like the web's RequestTime. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type PreferenceKey = (typeof notificationPreferenceOptions)[number]["key"];

/** Preferences of the signed-in user; mounted only while the panel is open, as on the web. */
function usePreferencesModel(userId: number, open: boolean) {
  const { query, preferences, set } = useNotificationPreferences(userId);
  const model: NativeNotificationPreferences | null = open
    ? {
        status: query.data ? "ready" : query.isError ? "error" : "loading",
        options: query.data
          ? notificationPreferenceOptions.map(({ key, title, description }) => ({
              key,
              title,
              description,
              value: query.data[key],
            }))
          : [],
        saving: preferences.isPending,
        saved: preferences.isSuccess,
        failed: preferences.isError,
      }
    : null;
  return {
    model,
    retry: () => void query.refetch(),
    set: (key: string, value: boolean) => {
      if (
        query.data &&
        !preferences.isPending &&
        notificationPreferenceOptions.some((option) => option.key === key)
      )
        set(key as PreferenceKey, value);
    },
  };
}

/** In the app /notifications is drawn natively (native/screens/profile/notifications.tsx). */
export function NativeNotificationsBridge({
  onSearch,
  overlay = false,
}: {
  onSearch: () => void;
  overlay?: boolean;
}) {
  const userId = useCurrentUserId();
  return <Inbox key={userId ?? "guest"} userId={userId} onSearch={onSearch} overlay={overlay} />;
}

function Inbox({
  userId,
  onSearch,
  overlay,
}: {
  userId: number | null;
  onSearch: () => void;
  overlay: boolean;
}) {
  const { onBack, ...navigation } = useNotificationPanelNavigation(overlay);
  const inbox = useNotificationInbox(userId, navigation);
  const now = useNow();
  const preferences = usePreferencesModel(userId ?? 0, userId !== null && inbox.settings);
  const { list, groups } = inbox;

  const model: NativeNotifications = {
    signedIn: userId !== null,
    unreadCount: inbox.count.data?.count ?? 0,
    preferences: preferences.model,
    categories,
    category: inbox.category,
    unreadOnly: inbox.unreadOnly,
    readAllDisabled: inbox.readAllDisabled,
    deleteReadDisabled: inbox.deleteReadDisabled,
    error: inbox.error,
    notice: inbox.notice,
    status: list.isPending ? "loading" : list.isError ? "error" : "ready",
    items: groups.map((group) => {
      const item = group.first;
      const { unread, pending } = notificationRowState(group);
      return {
        id: item.id,
        title: item.title,
        countLabel: group.items.length > 1 ? `${group.items.length}명` : null,
        unread,
        time: requestAge(item.createdAt, now),
        body: notificationBody(group),
        link:
          pending && item.type === "CONTRIBUTION_CREATED"
            ? "project"
            : item.path && item.available
              ? "detail"
              : null,
        pending,
        statusLabel:
          !pending && item.requestStatus ? notificationStatusLabel(item.requestStatus) : null,
      };
    }),
    emptyMessage: inbox.emptyMessage,
    busy: inbox.busy,
    paging: list.hasNextPage ? { busy: list.isFetchingNextPage } : null,
  };

  const group = (id: number) => groups.find((entry) => entry.first.id === id);
  return useNativeScreen("profile-notifications", model, {
    overlay,
    header: { left: "back", actions: ["notifications", "chat", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "category":
          return inbox.chooseCategory(
            categories.find((category) => category.id === action.id)
              ?.id as NotificationCategory | null,
          );
        case "unread-only":
          return inbox.setUnreadOnly(!inbox.unreadOnly);
        case "read-all":
          if (!inbox.readAllDisabled) inbox.readAllNow();
          return;
        case "delete-read":
          if (!inbox.deleteReadDisabled) inbox.deleteReadNow();
          return;
        case "toggle-preferences":
          return inbox.setSettings(!inbox.settings);
        case "preferences-retry":
          return preferences.retry();
        case "preference":
          return preferences.set(action.key, action.value);
        case "retry":
          return void list.refetch();
        case "more":
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          return;
        case "open": {
          const target = group(action.id);
          if (target && !inbox.busy) inbox.open(target);
          return;
        }
        case "read": {
          const target = group(action.id);
          if (target && !inbox.busy) inbox.markRead(target);
          return;
        }
        case "delete": {
          const target = group(action.id);
          if (target && !inbox.busy) inbox.deleteItem(target);
          return;
        }
        case "project": {
          const target = group(action.id);
          if (target && !inbox.busy) inbox.openProject(target);
          return;
        }
        case "review": {
          const target = group(action.id);
          if (target && !inbox.busy) inbox.review(target, action.accept);
          return;
        }
      }
    },
  });
}

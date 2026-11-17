import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { NotificationPanel } from "./notification-panel";
import { nativeApp } from "@/lib/native-app";
export function NotificationsOverlay() {
  const { query } = useUrlNavigation();
  if (nativeApp()) return null;
  return query.get("notifications") === "1" ? <NotificationPanel overlay /> : null;
}

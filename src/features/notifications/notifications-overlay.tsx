import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { NotificationPanel } from "./notification-panel";
export function NotificationsOverlay() {
  const { query } = useUrlNavigation();
  return query.get("notifications") === "1" ? <NotificationPanel overlay /> : null;
}

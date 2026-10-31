import { NotificationsScreen } from "@/features/notifications/notifications-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function NotificationsPage({ overlay = false }: { overlay?: boolean }) {
  const { to, back, currentPath, query, params } = useAppNavigation();
  function close() {
    if (!overlay) {
      back("/");
      return;
    }
    const next = new URLSearchParams(query);
    next.delete("notifications");
    const path = window.location.pathname + (next.size ? `?${next}` : "");
    if (window.history.state?.idx > 0) back(path);
    else to(path, { replace: true });
  }
  return (
    <NotificationsScreen
      onBack={close}
      onOpenProject={(id) =>
        to(`/studio/${id}`, { state: { studioFrom: currentPath, inbox: true } })
      }
      onOpenSubmission={(id) => to(`/submissions/${id}`)}
      onOpenFriends={() => to("/friends")}
      onReviewInbox={() => to("/reviews")}
      key={params.projectId ?? "notifications"}
    />
  );
}

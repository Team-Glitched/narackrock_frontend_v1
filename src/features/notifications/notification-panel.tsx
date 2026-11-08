import { withQuery } from "@/features/navigation/paths";
import { useLocation, useNavigate } from "react-router";
import { NotificationsScreen } from "./notifications-screen";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
export function NotificationPanel({ overlay = false }: { overlay?: boolean }) {
  const { to, back, currentPath, query, state } = useUrlNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  function close() {
    if (!overlay) { back("/"); return; }
    const next = new URLSearchParams(query);
    next.delete("notifications");
    const path = location.pathname + (next.size ? "?" + next : "") + location.hash;
    if (window.history.state?.idx > 0) navigate(-1);
    else to(path, { replace: true, state: { ...state } });
  }
  return <NotificationsScreen
    onBack={close}
    onNavigate={(path) => to(path)}
    onOpenProject={(id, contributionId) => to(withQuery(`/studio/${id}`, { contributionId }), { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx, inbox: true } })}
    onOpenProfile={(id) => to("/users/" + id)}
  />;
}

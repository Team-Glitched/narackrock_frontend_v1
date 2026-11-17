import { useLocation, useNavigate } from "react-router";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
export function useNotificationsNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentPath } = useUrlNavigation();
  return {
    openNotifications: () => {
      const next = new URLSearchParams(location.search);
      if (location.pathname === "/notifications" || next.get("notifications") === "1") return;
      next.set("notifications", "1");
      navigate(
        { pathname: location.pathname, search: next.toString(), hash: location.hash },
        {
          state: { from: currentPath, ...location.state },
        },
      );
    },
  };
}

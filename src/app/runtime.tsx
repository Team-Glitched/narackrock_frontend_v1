import { RequireAuth } from "@/features/auth/require-auth";
import { requiresLogin } from "@/features/auth/login-access";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { useNativeReports } from "./native-reports";
import { nativeApp } from "@/lib/native-app";
import { NativeNotificationsBridge } from "@/features/notifications/native-notifications-bridge";

export function AppRuntime() {
  useWebMcpNavigation();
  useNativeReports();
  const location = useLocation();
  const navigate = useNavigate();
  const overlay = nativeApp() && new URLSearchParams(location.search).get("notifications") === "1";
  return (
    <RequireAuth required={requiresLogin(location.pathname + location.search)}>
      <Outlet />
      {overlay && <NativeNotificationsBridge overlay onSearch={() => navigate("/search")} />}
    </RequireAuth>
  );
}

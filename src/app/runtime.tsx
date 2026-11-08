import { RequireAuth } from "@/features/auth/require-auth";
import { requiresLogin } from "@/features/auth/login-access";
import { Outlet, useLocation } from "react-router";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export function AppRuntime() {
  useWebMcpNavigation();
  const location = useLocation();
  return requiresLogin(location.pathname + location.search) ? (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ) : (
    <Outlet />
  );
}

import { Navigate, useLocation } from "react-router";
import { useAppSession } from "@/app/session";
import { appPath } from "@/features/navigation/paths";
import type { ReactNode } from "react";
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUserId, preview } = useAppSession();
  const location = useLocation();
  if (currentUserId === null) return <Navigate to={appPath("/login", preview)} replace state={{ returnTo: location.pathname + location.search, from: location.state?.from }} />;
  return children;
}

import { Navigate, useLocation } from "react-router";
import { useAuthSession } from "@/features/auth/auth-session";
import type { ReactNode } from "react";
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUserId } = useAuthSession();
  const location = useLocation();
  if (currentUserId === null)
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname + location.search, from: location.state?.from }}
      />
    );
  return children;
}

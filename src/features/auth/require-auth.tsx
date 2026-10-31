import { Navigate, useLocation } from "react-router";
import { useAppSession } from "@/app/session";
import type { ReactNode } from "react";
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUserId } = useAppSession();
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

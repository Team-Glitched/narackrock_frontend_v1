import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { operatorStatusQuery } from "./admin-queries";

/** Whether the signed-in account is an operator admin; `false` while loading, on error and when signed out. */
export function useOperatorAdmin(): boolean {
  const userId = useCurrentUserId();
  const { data } = useQuery(operatorStatusQuery(userId));
  return data?.operatorAdmin === true;
}

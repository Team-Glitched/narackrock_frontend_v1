import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { safeReturnPath } from "./paths";

export type NavigationState = { from?: string };
export function useUrlNavigation<S extends NavigationState = NavigationState>() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const state = (location.state ?? {}) as S;
  const currentPath = location.pathname + location.search + location.hash;
  const to = useCallback(
    (path: string, options: { replace?: boolean; state?: NavigationState & Record<string, unknown> } = {}) => {
      navigate(path, { replace: options.replace, state: { from: currentPath, ...options.state } });
    },
    [navigate, currentPath],
  );
  const back = useCallback(
    (fallback = "/") => {
      if (state.from && window.history.state?.idx > 0) navigate(-1);
      else navigate(safeReturnPath(state.from, fallback), { replace: true });
    },
    [navigate, state.from],
  );
  return { to, back, params, query, state, currentPath };
}

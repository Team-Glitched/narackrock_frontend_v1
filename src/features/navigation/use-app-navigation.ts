import { useCallback } from "react";
import { useLocation, useMatches, useNavigate } from "react-router";
import type { PageRoute } from "./route-config";
import type { Navigate, View } from "./types";
import { readId, safeReturnPath, viewPath, withQuery } from "./paths";
import { creationForView, screenScope, type SearchScope } from "./context-actions";

export type AppLocationState = { from?: string; returnTo?: string; studioFrom?: string; studioIndex?: number; inbox?: boolean; pending?: { suggestedNickname: string; pictureUrl: string | null } };
export function useAppRoute() {
  const matches = useMatches();
  const leaf = matches.at(-1)!;
  return { page: leaf.handle as PageRoute, params: leaf.params };
}

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { page, params } = useAppRoute();
  const query = new URLSearchParams(location.search);
  const state = (location.state ?? {}) as AppLocationState;
  const currentPath = location.pathname + location.search + location.hash;
  const to = useCallback((path: string, options: { replace?: boolean; state?: AppLocationState } = {}) => {
    navigate(path, { replace: options.replace, state: { from: currentPath, ...options.state, ...(options.state?.studioFrom === currentPath && options.state.studioIndex == null ? { studioIndex: window.history.state?.idx } : {}) } });
  }, [navigate, currentPath]);
  const back = useCallback((fallback = page.back ?? "/") => {
    if (state.from && window.history.state?.idx > 0) navigate(-1);
    else navigate(safeReturnPath(state.from, fallback), { replace: true });
  }, [navigate, page.back, state.from]);
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const tab = page.view === "community" ? "community" : page.view === "friends" ? "friends" : "posts";
  const defaultScope = screenScope(page.view, tab, Boolean(galleryId));
  const scopeValue = query.get("scope");
  const scope: SearchScope = ["sources", "songs", "people", "posts", "communities"].includes(scopeValue ?? "") ? scopeValue as SearchScope : defaultScope;
  const openSearch = () => to(withQuery("/search", { scope, galleryId }));
  const openNotifications = () => {
    if (page.id === "notifications" || query.get("notifications") === "1") return;
    const next = new URLSearchParams(location.search);
    next.set("notifications", "1");
    navigate({ pathname: location.pathname, search: next.toString() }, { state: { ...state, from: currentPath } });
  };
  const openCreate = () => {
    const kind = creationForView(page.view, scope);
    if (kind === "song") { to("/studio/new", { state: { studioFrom: currentPath } }); return; }
    if (kind === "friend") { to("/search?scope=people"); return; }
    to(kind === "post" ? withQuery("/posts/new", { galleryId }) : kind === "community" ? "/communities/new" : "/sources/new");
  };
  const go: Navigate = (view: View, id?: number) => {
    if (view === "search") { openSearch(); return; }
    if (view === "notifications") { openNotifications(); return; }
    to(viewPath(view, { id, galleryId, projectId: readId(params.projectId), trackId: readId(params.trackId) ?? readId(query.get("trackId")), clipId: readId(query.get("clipId")), shortId: readId(params.shortId) ?? readId(query.get("shortId")) }), { state: view === "studio" ? { studioFrom: currentPath } : undefined });
  };
  return { to, back, go, openSearch, openCreate, openNotifications, page, params, query, state, currentPath, scope, galleryId };
}

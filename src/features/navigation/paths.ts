import type { View } from "./types.ts";

export function readId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function safeReturnPath(value: unknown, fallback = "/"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return fallback;
  const url = new URL(value, "https://narackrock.local");
  if (url.origin !== "https://narackrock.local" || url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}

export function withQuery(
  path: string,
  values: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value != null && value !== "") query.set(key, String(value));
  return query.size ? `${path}?${query}` : path;
}

export function studioPath(projectId: number, shortId?: number | null): string {
  return withQuery(`/studio/${projectId}`, { shortId });
}

export function notesPath(
  projectId: number,
  trackId: number,
  clipId?: number | null,
  shortId?: number | null,
): string {
  return withQuery(`/studio/${projectId}/tracks/${trackId}/notes`, { clipId, shortId });
}

type ViewTarget = {
  id?: number;
  projectId?: number | null;
  trackId?: number | null;
  clipId?: number | null;
  galleryId?: number | null;
  shortId?: number | null;
};

/** Compatibility for existing screen callbacks; the destination is always a URL. */
export function viewPath(view: View, target: ViewTarget = {}): string {
  const paths: Partial<Record<View, string>> = {
    home: "/",
    abyss: "/abyss",
    charts: "/charts",
    posts: "/posts",
    social: "/social",
    community: "/communities",
    friends: "/friends",
    joined: "/communities/joined",
    search: "/search",
    opensource: "/sources",
    createSource: "/sources/new",
    createPost: "/posts/new",
    createCommunity: "/communities/new",
    profile: target.id ? `/users/${target.id}` : "/profile",
    edit: "/profile/edit",
    login: "/login",
    settings: "/settings",
    saved: "/saved",
    admin: "/admin",
    chat: "/chat",
    notifications: "/notifications",
    workspace: "/workspace",
    submissions: "/submissions",
    reviewInbox: "/reviews",
    sourceLibrary: "/library",
    submissionDetail: target.id ? `/submissions/${target.id}` : "/submissions",
    communityAdmin: target.galleryId
      ? `/communities/${target.galleryId}/manage`
      : "/communities/manage",
    opensourceDetail: target.id ? `/sources/${target.id}` : "/sources",
    opensourceComments: target.id ? `/sources/${target.id}/comments` : "/sources",
  };
  if (view === "studio") return "/studio/new";
  if (["choose", "upload", "record", "note", "importSource"].includes(view)) {
    if (!target.projectId) return view === "importSource" ? "/library" : "/studio/new";
    if (view === "note")
      return target.trackId
        ? notesPath(target.projectId, target.trackId, target.clipId, target.shortId)
        : studioPath(target.projectId, target.shortId);
    const step = view === "choose" ? "layers/new" : view === "importSource" ? "import" : view;
    return withQuery(`/studio/${target.projectId}/${step}`, {
      shortId: target.shortId,
      trackId: target.trackId,
      clipId: target.clipId,
    });
  }
  return paths[view] ?? "/";
}

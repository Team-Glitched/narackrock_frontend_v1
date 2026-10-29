import { notesPath, readId, studioPath, withQuery } from "./paths.ts";
import type { PageRoute } from "./route-config.ts";
export function routeBackPath(page: PageRoute, params: Record<string, string | undefined>, query: URLSearchParams): string {
  const galleryId = readId(params.galleryId);
  const projectId = readId(params.projectId);
  const shortId = readId(query.get("shortId"));
  if (page.id === "communityMembers" && galleryId) return `/communities/${galleryId}/manage`;
  if (["communityAdmin", "communityPost"].includes(page.id) && galleryId) return `/communities/${galleryId}`;
  if (["upload", "record"].includes(page.id) && projectId) return withQuery(`/studio/${projectId}/layers/new`, { shortId });
  if (["choose", "notes"].includes(page.id) && projectId) return studioPath(projectId, shortId);
  if (page.id === "import" && projectId) {
    const trackId = readId(query.get("trackId"));
    return trackId ? notesPath(projectId, trackId, readId(query.get("clipId")), shortId) : studioPath(projectId, shortId);
  }
  if (page.id === "createSource" && query.has("stage")) return withQuery("/sources/new", { stage: query.get("stage") === "choose" ? null : "choose" });
  return page.back ?? "/";
}

type GalleryState =
  | { status: "loading" | "error" }
  | { status: "ready"; galleries: readonly { galleryId: number }[] };
type Membership = {
  loading: boolean;
  loadFailed: boolean;
  isJoined: (galleryId: number) => boolean;
  isPending: (galleryId: number) => boolean;
};
export type PostTargetStatus = "loading" | "error" | "missing" | "not_joined" | "ready";
export function resolvePostTarget(
  galleries: GalleryState,
  galleryId: number,
  membership: Membership,
): PostTargetStatus {
  if (galleries.status !== "ready") return galleries.status;
  if (!galleries.galleries.some((gallery) => gallery.galleryId === galleryId)) return "missing";
  if (membership.loading || membership.isPending(galleryId)) return "loading";
  if (membership.loadFailed) return "error";
  return membership.isJoined(galleryId) ? "ready" : "not_joined";
}

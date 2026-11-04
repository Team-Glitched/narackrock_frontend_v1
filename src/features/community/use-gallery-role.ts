import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { getMyGalleryRole, type GalleryRole } from "@/lib/api/community";

/** Moderation scope handed to post/comment UI; `canManage` comes only from `GET /galleries/{id}/manage/me`. */
export type ModerationScope = { galleryId: number; canManage: boolean };

/** A manager may sanction anyone in the gallery except themselves. */
export function canSanction(scope: ModerationScope | undefined, me: number | null, memberId: number) {
  return Boolean(scope?.canManage) && me !== null && memberId !== me;
}

/** The signed-in user's role in a gallery; null while loading, when signed out or when it cannot be read. */
export function useGalleryRole(galleryId: number | null): GalleryRole | null {
  const userId = useCurrentUserId();
  const key = `${userId}:${galleryId}`;
  const [loaded, setLoaded] = useState<{ key: string; role: GalleryRole | null } | null>(null);
  useEffect(() => {
    if (userId === null || galleryId === null) return;
    const controller = new AbortController();
    getMyGalleryRole(galleryId, controller.signal)
      .then((role) => setLoaded({ key, role }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, role: null });
      });
    return () => controller.abort();
  }, [galleryId, key, userId]);
  return loaded?.key === key ? loaded.role : null;
}

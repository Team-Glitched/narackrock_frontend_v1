import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { getMyGalleryRole, type GalleryRole } from "@/lib/api/community";

/** Moderation scope handed to post/comment UI; `canManage` comes only from `GET /galleries/{id}/manage/me`. */
export type ModerationScope = { galleryId: number; canManage: boolean };

/** A manager may sanction anyone in the gallery except themselves. */
export function canSanction(scope: ModerationScope | undefined, me: number | null, memberId: number) {
  return Boolean(scope?.canManage) && me !== null && memberId !== me;
}

/** Loads the signed-in user's gallery role and allows failed requests to be retried. */
export function useGalleryRole(galleryId: number | null) {
  const userId = useCurrentUserId();
  const [revision, setRevision] = useState(0);
  const key = `${userId}:${galleryId}:${revision}`;
  const [loaded, setLoaded] = useState<{ key: string; role: GalleryRole | null } | null>(null);
  useEffect(() => {
    if (userId === null || galleryId === null) return;
    const controller = new AbortController();
    getMyGalleryRole(galleryId, controller.signal)
      .then((role) => {
        if (!controller.signal.aborted) setLoaded({ key, role });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, role: null });
      });
    return () => controller.abort();
  }, [galleryId, key, userId]);
  const current = loaded?.key === key ? loaded : null;
  return {
    role: current?.role ?? null,
    failed: current?.role === null,
    retry: () => setRevision((value) => value + 1),
  };
}

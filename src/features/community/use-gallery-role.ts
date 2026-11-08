import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { galleryRoleQuery } from "@/features/community/community-queries";

/** Moderation scope handed to post/comment UI; `canManage` comes only from `GET /galleries/{id}/manage/me`. */
export type ModerationScope = { galleryId: number; canManage: boolean };

/** A manager may sanction anyone in the gallery except themselves. */
export function canSanction(scope: ModerationScope | undefined, me: number | null, memberId: number) {
  return Boolean(scope?.canManage) && me !== null && memberId !== me;
}

/** Loads the signed-in user's gallery role and allows failed requests to be retried. */
export function useGalleryRole(galleryId: number | null) {
  const userId = useCurrentUserId();
  const { data, isLoadingError, refetch } = useQuery(galleryRoleQuery(userId, galleryId));
  return {
    role: data ?? null,
    failed: isLoadingError,
    retry: () => void refetch(),
  };
}

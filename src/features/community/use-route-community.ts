import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { galleriesQuery } from "@/features/community/community-queries";
import { galleryToCommunity, type Community } from "@/features/community/community-card";

type Result =
  | { id: number; status: "ready"; community: Community }
  | { id: number | null; status: "loading" | "error" | "missing" };

/** The community of a route's gallery ID, looked up in the shared gallery list. */
export function useRouteCommunity(id: number | null): Result {
  const userId = useCurrentUserId();
  const { data, isError } = useQuery({ ...galleriesQuery(userId), enabled: id !== null });
  return useMemo((): Result => {
    if (id === null) return { id, status: "missing" };
    if (!data) return { id, status: isError ? "error" : "loading" };
    const gallery = data.find((item) => item.galleryId === id);
    return gallery
      ? { id, status: "ready", community: galleryToCommunity(gallery) }
      : { id, status: "missing" };
  }, [data, id, isError]);
}

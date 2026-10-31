import { useEffect, useState } from "react";
import { fetchGalleries } from "@/lib/api/community";
import { galleryToCommunity, type Community } from "@/features/community/community-card";

type Result =
  | { id: number; status: "ready"; community: Community }
  | { id: number; status: "error" | "missing" };
export function useRouteCommunity(id: number | null) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (id === null) return;
    let active = true;
    fetchGalleries()
      .then((galleries) => {
        if (!active) return;
        const gallery = galleries.find((item) => item.galleryId === id);
        setResult(
          gallery
            ? { id, status: "ready", community: galleryToCommunity(gallery) }
            : { id, status: "missing" },
        );
      })
      .catch(() => {
        if (active) setResult({ id, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [id]);
  return result?.id === id
    ? result
    : { id, status: id === null ? ("missing" as const) : ("loading" as const) };
}

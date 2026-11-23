import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { addFeaturedMusic, removeFeaturedMusic } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";
import { profileKeys, profileQuery } from "./profile-queries";
import {
  FEATURED_MUSIC_LIMIT_MESSAGE,
  MAX_FEATURED_MUSIC,
  canPinMoreFeatured,
  toggleFeaturedList,
  type PinnedSongInput,
} from "./featured-music-state";

export {
  FEATURED_MUSIC_LIMIT_MESSAGE,
  MAX_FEATURED_MUSIC,
  canPinMoreFeatured,
  toggleFeaturedList,
  type PinnedSongInput,
};

/** Shared state and mutation handler for pinning/unpinning up to 5 featured songs on the signed-in user's profile. */
export function useFeaturedMusic(enabled = true) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const profile = useQuery({
    ...profileQuery(userId, userId ?? 0),
    enabled: enabled && userId !== null,
  });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pinnedShorts = profile.data?.activities.pinnedShorts ?? [];
  const pinnedIds = new Set(pinnedShorts.map((song) => song.shortId));

  async function toggleFeatured(song: PinnedSongInput) {
    if (userId === null || !profile.data || savingId !== null) return;
    const currentlyPinned = pinnedIds.has(song.shortId);
    if (!currentlyPinned && !canPinMoreFeatured(pinnedShorts, song.shortId)) {
      setNotice(FEATURED_MUSIC_LIMIT_MESSAGE);
      return;
    }
    setSavingId(song.shortId);
    setNotice(null);
    try {
      if (currentlyPinned) {
        await removeFeaturedMusic(song.shortId);
      } else {
        await addFeaturedMusic(song.shortId);
      }
      queryClient.setQueryData<UserProfile | undefined>(
        profileKeys.detail(userId, userId),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            activities: {
              ...prev.activities,
              pinnedShorts: toggleFeaturedList(prev.activities.pinnedShorts, song, currentlyPinned),
            },
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId, userId) });
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "대표 음악을 변경하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  return {
    profile,
    pinnedShorts,
    pinnedIds,
    pinnedCount: pinnedShorts.length,
    maxFeatured: MAX_FEATURED_MUSIC,
    savingId,
    notice,
    clearNotice: () => setNotice(null),
    toggleFeatured,
  };
}

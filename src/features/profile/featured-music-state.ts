export const MAX_FEATURED_MUSIC = 5;
export const FEATURED_MUSIC_LIMIT_MESSAGE = "대표 음악은 최대 5개까지 설정할 수 있습니다.";

export type PinnedSongInput = {
  shortId: number;
  title: string;
  albumImageUrl: string | null;
  mediaUrl?: string | null;
};

export type PinnedSongEntry = {
  shortId: number;
  title: string;
  albumImageUrl: string | null;
  mediaUrl: string | null;
  displayOrder: number;
};

export function canPinMoreFeatured(
  pinned: readonly Pick<PinnedSongEntry, "shortId">[],
  shortId: number,
): boolean {
  return pinned.some((item) => item.shortId === shortId) || pinned.length < MAX_FEATURED_MUSIC;
}

export function toggleFeaturedList(
  current: readonly PinnedSongEntry[],
  song: PinnedSongInput,
  currentlyPinned: boolean,
): PinnedSongEntry[] {
  if (currentlyPinned) {
    return current.filter((item) => item.shortId !== song.shortId);
  }
  if (current.some((item) => item.shortId === song.shortId)) {
    return [...current];
  }
  const nextOrder = current.reduce((max, item) => Math.max(max, item.displayOrder + 1), 0);
  return [
    ...current,
    {
      shortId: song.shortId,
      title: song.title,
      albumImageUrl: song.albumImageUrl,
      mediaUrl: song.mediaUrl ?? null,
      displayOrder: nextOrder,
    },
  ];
}

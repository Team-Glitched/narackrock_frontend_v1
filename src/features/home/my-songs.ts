import type { ShortItemDto } from "../../lib/api/contracts.ts";

export type MySongTab = "authored" | "participated";
export function songsForTab(items: ShortItemDto[], userId: number, tab: MySongTab) {
  return items.filter((song) => (song.author.userId === userId) === (tab === "authored"));
}
export function appendUniqueSongs(items: ShortItemDto[], incoming: ShortItemDto[]) {
  const ids = new Set(items.map((song) => song.shortId));
  return [...items, ...incoming.filter((song) => {
    if (ids.has(song.shortId)) return false;
    ids.add(song.shortId);
    return true;
  })];
}

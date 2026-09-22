import type { ShortItemDto } from "@/lib/api/contracts";

export function initialShortIndex(items: ShortItemDto[], shortId: number | null | undefined) {
  if (shortId == null) return 0;
  const index = items.findIndex((item) => item.shortId === shortId);
  return index >= 0 ? index : 0;
}

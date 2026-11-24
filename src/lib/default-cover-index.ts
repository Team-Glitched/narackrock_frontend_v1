export const DEFAULT_COVER_COUNT = 5;

/**
 * Deterministic pseudo-random index in `[0, DEFAULT_COVER_COUNT)` for a content seed
 * so songs and posts spread across all default covers without flickering on re-render.
 */
export function defaultCoverIndex(seed?: string | number | null): number {
  const key = String(seed ?? "").trim();
  if (!key) return 0;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) % DEFAULT_COVER_COUNT;
}

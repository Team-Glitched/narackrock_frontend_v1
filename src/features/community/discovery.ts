/** Put different authors first while keeping the feed's order within each group. */
export function recommendByAuthor<T>(
  items: readonly T[],
  author: (item: T) => number,
  currentUserId: number | null,
): T[] {
  const others = items.filter((item) => author(item) !== currentUserId);
  const pool = others.length ? others : [...items];
  const seen = new Set<number>();
  const first: T[] = [],
    rest: T[] = [];
  for (const item of pool) {
    const id = author(item);
    if (seen.has(id)) rest.push(item);
    else {
      seen.add(id);
      first.push(item);
    }
  }
  return [...first, ...rest];
}
export function popularSources<T extends { id: number; usageCount?: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0) || b.id - a.id);
}

export function popularSources<T extends { id: number; usageCount?: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0) || b.id - a.id);
}

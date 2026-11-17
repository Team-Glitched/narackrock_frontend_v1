/** Exact nickname matches precede instrument/bio matches while preserving order within each group. */
export function prioritizeExactNickname<T extends { nickname: string | null }>(
  items: T[],
  keyword: string,
): T[] {
  const trimmed = keyword.trim();
  if (!trimmed) return items;
  const lowered = trimmed.toLowerCase();
  const exact: T[] = [];
  const exactIgnoreCase: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const nick = item.nickname?.trim() ?? "";
    if (nick === trimmed) exact.push(item);
    else if (nick.toLowerCase() === lowered) exactIgnoreCase.push(item);
    else rest.push(item);
  }
  return [...exact, ...exactIgnoreCase, ...rest];
}

/** Deduplicates paged search results by `userId` and sorts exact nickname matches to the top. */
export function mergeManagerSearchPage<T extends { userId: number; nickname: string | null }>(
  existing: T[],
  incoming: T[],
  keyword: string,
): T[] {
  const seen = new Set(existing.map((person) => person.userId));
  const merged = [...existing];
  for (const person of incoming) {
    if (!seen.has(person.userId)) {
      seen.add(person.userId);
      merged.push(person);
    }
  }
  return prioritizeExactNickname(merged, keyword);
}

/** Hides the operator entry when the status query is in an error state, even with stale cached `true`. */
export function isOperatorAdminVisible(
  data: { operatorAdmin: boolean } | undefined,
  isError: boolean,
): boolean {
  return !isError && data?.operatorAdmin === true;
}

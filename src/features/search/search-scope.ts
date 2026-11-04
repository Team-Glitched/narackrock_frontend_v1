export type SearchScope = "sources" | "songs" | "people" | "posts" | "communities";
export function resolveSearchScope(value: string | null, fallback: SearchScope, insideCommunity: boolean): SearchScope {
  if (value === "sources" || value === "songs" || value === "people" || value === "posts" || value === "communities") return value;
  return insideCommunity ? "posts" : fallback;
}

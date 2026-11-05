import type { PostSort } from "@/lib/api/contracts";

export function parsePostSort(value: string | null): PostSort {
  return value === "POPULAR" || value === "OLDEST" ? value : "LATEST";
}

/** Change only sorting, retaining unrelated gallery/search query parameters. */
export function postSortQuery(query: URLSearchParams, sort: PostSort): string {
  const next = new URLSearchParams(query);
  next.set("sort", sort);
  return next.toString();
}

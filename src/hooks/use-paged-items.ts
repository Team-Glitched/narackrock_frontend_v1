import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { queryScope } from "@/lib/query";

export type ItemPage<T, Cursor> = { items: T[]; next: Cursor | null };

/** Cache key of a paged list: a tuple scope is used as given (domain first); a string scope is grouped under "paged". */
export function pagedItemsKey(userId: number | null, scope: string | readonly unknown[]): readonly unknown[] {
  return [...queryScope(userId), ...(typeof scope === "string" ? ["paged", scope] : scope)];
}

/** A cursor already requested ends the list, so a server that repeats a cursor cannot loop. */
function nextCursor<Cursor>(page: ItemPage<unknown, Cursor>, requested: Cursor[]): Cursor | null {
  return page.next !== null && !requested.includes(page.next) ? page.next : null;
}

export function usePagedItems<T, Cursor>(
  scope: string | readonly unknown[],
  first: Cursor,
  load: (cursor: Cursor, signal: AbortSignal) => Promise<ItemPage<T, Cursor>>,
  enabled = true,
) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const queryKey = pagedItemsKey(userId, scope);
  const { data, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery<
    ItemPage<T, Cursor>, Error, InfiniteData<ItemPage<T, Cursor>, Cursor>, readonly unknown[], Cursor
  >({
    queryKey,
    // TanStack's context type is conditional on the page parameter, which stays unresolved for a generic `Cursor`.
    queryFn: ({ pageParam, signal }) => load(pageParam as Cursor, signal),
    initialPageParam: first,
    getNextPageParam: (last, _pages, _lastParam, requested) => nextCursor(last, requested),
    enabled,
  });

  const state = !enabled
    ? null
    : data
      ? {
          items: data.pages.flatMap((page) => page.items),
          next: hasNextPage ? nextCursor(data.pages[data.pages.length - 1], data.pageParams) : null,
          busy: isFetchingNextPage,
          error: error ? { cause: error } : null,
        }
      : error
        ? { items: [] as T[], next: first, busy: isFetching, error: { cause: error } }
        : null;

  return {
    state,
    /** Loads the following page, or retries the first page after it failed. */
    more: () => {
      if (!enabled || isFetchingNextPage) return;
      if (data) {
        if (hasNextPage) void fetchNextPage();
      } else if (!isFetching) void refetch();
    },
    reload: () => void queryClient.resetQueries({ queryKey, exact: true }),
    remove: (predicate: (item: T) => boolean) => {
      queryClient.setQueryData<InfiniteData<ItemPage<T, Cursor>, Cursor>>(queryKey, (old) =>
        old && { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.filter((item) => !predicate(item)) })) },
      );
    },
  };
}

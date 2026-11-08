import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import {
  getOpenSource,
  listMyOpenSourcePublications,
  listOpenSources,
  listSavedOpenSources,
  setOpenSourceSaved,
  type OpenSourceDetail,
  type OpenSourcePage,
  type OpenSourceSummary,
} from "@/lib/api/open-sources";
import { queryScope } from "@/lib/query";

export const sourceKeys = {
  all: (userId: number | null) => [...queryScope(userId), "sources"] as const,
  lists: (userId: number | null) => [...sourceKeys.all(userId), "list"] as const,
  list: (userId: number | null, keyword: string) => [...sourceKeys.lists(userId), keyword] as const,
  detail: (userId: number | null, sourceId: number) =>
    [...sourceKeys.all(userId), "detail", sourceId] as const,
  /** The account's saved-source library; `usePagedItems(["sources", "saved"], …)` owns this key. */
  saved: (userId: number | null) => [...sourceKeys.all(userId), "saved"] as const,
  publications: (userId: number | null) => [...sourceKeys.all(userId), "publications"] as const,
};

/** Public sources for a keyword in offset pages; items repeated by a shifted page are kept once. */
export const openSourceListQuery = (userId: number | null, keyword: string) =>
  infiniteQueryOptions({
    queryKey: sourceKeys.list(userId, keyword),
    queryFn: ({ pageParam, signal }) => listOpenSources({ keyword, page: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, page) => (last.hasNext ? page + 1 : undefined),
  });

export const openSourceQuery = (userId: number | null, sourceId: number) =>
  queryOptions({
    queryKey: sourceKeys.detail(userId, sourceId),
    queryFn: ({ signal }) => getOpenSource(sourceId, signal),
  });

/** The owner's publications (PRIVATE and PUBLIC) in offset pages of 50. */
export const sourcePublicationsQuery = (userId: number | null) =>
  infiniteQueryOptions({
    queryKey: sourceKeys.publications(userId),
    queryFn: ({ pageParam, signal }) => listMyOpenSourcePublications(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, page) => (last.hasNext ? page + 1 : undefined),
  });

/** Paged-list scope and loader of the saved-source library shared by every `usePagedItems` reader. */
export const savedSourcesScope = ["sources", "saved"] as const;
export async function loadSavedSources(page: number, signal: AbortSignal) {
  const result = await listSavedOpenSources(page, signal);
  return { items: result.items, next: result.hasNext ? page + 1 : null };
}

/** Writes a server-confirmed change of one source into its cached detail and every cached public list. */
export function patchSource(
  queryClient: QueryClient,
  userId: number | null,
  sourceId: number,
  patch: Partial<OpenSourceSummary>,
) {
  queryClient.setQueryData<OpenSourceDetail>(
    sourceKeys.detail(userId, sourceId),
    (old) => old && { ...old, ...patch },
  );
  queryClient.setQueriesData<InfiniteData<OpenSourcePage<OpenSourceSummary>, number>>(
    { queryKey: sourceKeys.lists(userId) },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.openSourceId === sourceId ? { ...item, ...patch } : item,
          ),
        })),
      },
  );
}

/**
 * Saves or unsaves a source. The server's answer updates cached sources; the saved library is reread from its first
 * page so an offset page shifted by the change never skips an item.
 */
export function useSourceSaveMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, saved }: { sourceId: number; saved: boolean }) =>
      setOpenSourceSaved(sourceId, saved),
    onSuccess: (result) => {
      patchSource(queryClient, userId, result.openSourceId, { isSaved: result.isSaved });
      void queryClient.invalidateQueries({ queryKey: sourceKeys.saved(userId) });
    },
  });
}

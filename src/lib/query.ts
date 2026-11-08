import { QueryClient } from "@tanstack/react-query";
import { ApiError, SessionChangedError, apiOrigin, subscribeCurrentUserId } from "./api/client";

/**
 * Server data is cached per backend origin and account: every query key starts with `queryScope(userId)`, so data of
 * another account or backend can never be read from the cache.
 */
export function queryScope(userId: number | null) {
  return [apiOrigin(), userId] as const;
}

/** Client errors (4xx) and a session that changed mid-request are final; network and 5xx failures retry once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof SessionChangedError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
    // Writes are never resent automatically: a lost response may already have been applied by the server.
    mutations: { retry: false },
  },
});

// Login, logout and account switches drop every cached response of the previous session.
subscribeCurrentUserId(() => queryClient.clear());

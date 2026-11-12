import { queryOptions } from "@tanstack/react-query";
import { getChatThreads, getUnreadChatCount } from "@/lib/api/social";
import { queryScope } from "@/lib/query";

export const chatKeys = {
  all: (userId: number | null) => [...queryScope(userId), "chat"] as const,
  unread: (userId: number | null) => [...chatKeys.all(userId), "unread"] as const,
  threads: (userId: number) => [...chatKeys.all(userId), "threads"] as const,
};

export const unreadChatQuery = (userId: number | null) =>
  queryOptions({
    queryKey: chatKeys.unread(userId),
    queryFn: ({ signal }) => getUnreadChatCount(signal),
    enabled: userId !== null,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

export const chatThreadsQuery = (userId: number) =>
  queryOptions({
    queryKey: chatKeys.threads(userId),
    queryFn: ({ signal }) => getChatThreads(signal),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });

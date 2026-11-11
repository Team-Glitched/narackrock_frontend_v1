import { useQuery, useQueryClient } from "@tanstack/react-query";
import { relationError } from "@/features/profile/profile-relations";
import { buildChatInbox } from "./chat-inbox";
import { chatKeys, chatThreadsQuery } from "./chat-queries";
import { mutualFollowersQuery } from "./social-queries";
import { useChatRealtime } from "./use-chat-realtime";

export function useChatInbox(me: number) {
  const queryClient = useQueryClient();
  const refreshThreads = () => void queryClient.invalidateQueries({ queryKey: chatKeys.threads(me) });
  const connected = useChatRealtime(me, refreshThreads, refreshThreads);
  const threads = useQuery({
    ...chatThreadsQuery(me),
    refetchInterval: connected ? 20_000 : 3_000,
  });
  const mutual = useQuery({
    ...mutualFollowersQuery(me),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });

  return {
    rows: threads.data ? buildChatInbox(threads.data, mutual.data ?? []) : [],
    loaded: threads.data !== undefined,
    error: threads.error ? relationError(threads.error, "대화 목록을 불러오지 못했습니다.") : "",
    connected,
    refresh: () => {
      void threads.refetch();
      void mutual.refetch();
    },
  };
}

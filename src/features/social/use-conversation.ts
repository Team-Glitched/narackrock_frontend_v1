import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api/client";
import { chatWebSocketUrl, getChatMessages, sendChatMessage, type ChatMessage } from "@/lib/api/social";
import { mergeChatMessages } from "@/features/social/chat-messages";
import { relationError } from "@/features/profile/profile-relations";

/**
 * One conversation: REST history, REST sending and STOMP delivery on `/user/queue/chat`. Every (re)connect sends
 * the current access token in the CONNECT header (never in the URL) and backfills over REST; while disconnected
 * the history is polled every 3 seconds. Unmounting (logout, account switch, leaving chat) closes both.
 */
export function useConversation(me: number, friendId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(true);
  const merge = useCallback(
    (incoming: ChatMessage[]) => setMessages((current) => mergeChatMessages(current, incoming, me, friendId)),
    [friendId, me],
  );
  const refresh = useCallback(
    () =>
      getChatMessages(friendId)
        .then((latest) => {
          merge(latest);
          setError("");
        })
        .catch((cause) => setError(relationError(cause, "대화를 불러오지 못했습니다.")))
        .finally(() => setLoaded(true)),
    [friendId, merge],
  );

  useEffect(() => {
    void refresh();
    const client = new Client({
      brokerURL: chatWebSocketUrl(),
      reconnectDelay: 3000,
      beforeConnect: (stomp) => {
        stomp.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` };
      },
      onConnect: () => {
        setConnected(true);
        client.subscribe("/user/queue/chat", (frame) => merge([JSON.parse(frame.body) as ChatMessage]));
        // Anything sent while the socket was down is recovered from REST.
        void refresh();
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [merge, refresh]);

  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [connected, refresh]);

  return {
    messages,
    loaded,
    connected,
    error,
    hasOlder,
    async loadOlder() {
      const oldest = messages[0]?.id;
      if (oldest === undefined) return;
      const older = await getChatMessages(friendId, oldest);
      if (older.length === 0) setHasOlder(false);
      merge(older);
    },
    async send(content: string) {
      merge([await sendChatMessage(friendId, content)]);
    },
  };
}

import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import { apiOrigin, getAccessToken, getCurrentUserId, subscribeCurrentUserId } from "@/lib/api/client";
import { chatWebSocketUrl, type ChatMessage } from "@/lib/api/social";

/** Delivery only: chat messages continue to be sent through REST, never STOMP SEND. */
export function useChatRealtime(me: number, onMessage: (message: ChatMessage) => void, onConnected: () => void) {
  const origin = apiOrigin();
  const scope = JSON.stringify([origin, me]);
  const callbacks = useRef({ onMessage, onConnected });
  useEffect(() => {
    callbacks.current = { onMessage, onConnected };
  }, [onMessage, onConnected]);
  const [connection, setConnection] = useState<{ scope: string; connected: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const current = () => active && getCurrentUserId() === me && apiOrigin() === origin;
    const disconnected = () => {
      if (current()) setConnection({ scope, connected: false });
    };
    const client = new Client({
      brokerURL: chatWebSocketUrl(),
      reconnectDelay: 3000,
      beforeConnect: (stomp) => {
        if (!current()) {
          void stomp.deactivate();
          return;
        }
        // Tokens may rotate between reconnects. Never retain a CONNECT credential.
        stomp.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` };
      },
      onConnect: () => {
        if (!current()) return;
        setConnection({ scope, connected: true });
        client.subscribe("/user/queue/chat", (frame) => {
          if (!current()) return;
          let message: ChatMessage;
          try {
            message = JSON.parse(frame.body) as ChatMessage;
          } catch {
            return;
          }
          if (message.senderId !== me && message.recipientId !== me) return;
          callbacks.current.onMessage(message);
        });
        callbacks.current.onConnected();
      },
      onWebSocketClose: disconnected,
      onWebSocketError: disconnected,
      onStompError: disconnected,
    });
    // Invalidate immediately, including a rapid A → B → A switch before React cleanup.
    const unsubscribe = subscribeCurrentUserId(() => {
      if (getCurrentUserId() === me) return;
      active = false;
      setConnection(null);
      void client.deactivate();
    });
    client.activate();
    return () => {
      active = false;
      unsubscribe();
      void client.deactivate();
    };
  }, [me, origin, scope]);
  return connection?.scope === scope && connection.connected;
}

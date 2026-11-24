import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiOrigin,
  getCurrentUserId,
  SessionChangedError,
  subscribeCurrentUserId,
} from "@/lib/api/client";
import {
  deleteChatMessage,
  editChatMessage,
  getChatMessages,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/api/social";
import { chatKeys } from "@/features/social/chat-queries";
import { chatMessageContent, mergeChatMessages } from "@/features/social/chat-messages";
import { createChatRefresh } from "@/features/social/chat-refresh";
import { useChatRealtime } from "@/features/social/use-chat-realtime";
import { useMarkChatRead } from "@/features/social/chat-unread";
import { relationError } from "@/features/profile/profile-relations";

/** REST history/sends with realtime delivery and disconnected REST recovery. */
export function useConversation(me: number, friendId: number) {
  const queryClient = useQueryClient();
  const origin = apiOrigin();
  const scope = JSON.stringify([origin, me, friendId]);
  const [state, setState] = useState({
    scope,
    messages: [] as ChatMessage[],
    loaded: false,
    error: "",
    hasOlder: true,
  });
  const refresh = useRef<(() => void) | null>(null);
  const currentSession = useRef<(() => boolean) | null>(null);
  const merge = useCallback(
    (incoming: ChatMessage[]) => {
      setState((previous) =>
        previous.scope === scope
          ? { ...previous, messages: mergeChatMessages(previous.messages, incoming, me, friendId) }
          : previous,
      );
    },
    [scope, me, friendId],
  );

  useEffect(() => {
    let active = true;
    const current = () => active && getCurrentUserId() === me && apiOrigin() === origin;
    currentSession.current = current;
    setState({ scope, messages: [], loaded: false, error: "", hasOlder: true });
    const coordinator = createChatRefresh({
      load: () => getChatMessages(friendId),
      isCurrent: current,
      onSuccess: (latest) =>
        setState((previous) => ({
          ...previous,
          messages: mergeChatMessages(previous.messages, latest, me, friendId),
          loaded: true,
          error: "",
        })),
      onError: (cause) =>
        setState((previous) => ({
          ...previous,
          loaded: true,
          error: relationError(cause, "대화를 불러오지 못했습니다."),
        })),
    });
    refresh.current = coordinator.request;
    const unsubscribe = subscribeCurrentUserId(() => {
      if (getCurrentUserId() !== me) {
        active = false;
        coordinator.dispose();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") coordinator.request();
    };
    window.addEventListener("focus", coordinator.request);
    document.addEventListener("visibilitychange", onVisible);
    coordinator.request();
    return () => {
      active = false;
      coordinator.dispose();
      refresh.current = null;
      currentSession.current = null;
      unsubscribe();
      window.removeEventListener("focus", coordinator.request);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [friendId, me, origin, scope]);

  const connected = useChatRealtime(
    me,
    (message) => merge([message]),
    () => refresh.current?.(),
  );
  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => refresh.current?.(), 3000);
    return () => window.clearInterval(timer);
  }, [connected, scope]);
  const current =
    state.scope === scope
      ? state
      : { scope, messages: [], loaded: false, error: "", hasOlder: true };
  const received =
    current.loaded && !current.error
      ? current.messages.filter((message) => message.recipientId === me)
      : [];
  useMarkChatRead(me, friendId, received.at(-1)?.id, received.length);
  return {
    ...current,
    connected,
    refresh: () => refresh.current?.(),
    async loadOlder() {
      const oldest = current.messages[0]?.id;
      const isCurrent = currentSession.current;
      if (oldest === undefined || !isCurrent?.()) return;
      try {
        const older = await getChatMessages(friendId, oldest);
        if (!isCurrent()) return;
        merge(older);
        setState((previous) => ({ ...previous, error: "", hasOlder: older.length > 0 }));
      } catch (cause) {
        if (isCurrent())
          setState((previous) => ({
            ...previous,
            error: relationError(cause, "이전 메시지를 불러오지 못했습니다."),
          }));
      }
    },
    async send(content: string) {
      const isCurrent = currentSession.current;
      if (!isCurrent?.()) throw new SessionChangedError();
      const sent = await sendChatMessage(friendId, content);
      if (!isCurrent()) throw new SessionChangedError();
      merge([sent]);
      void queryClient.invalidateQueries({ queryKey: chatKeys.all(me) });
    },
    async editMessage(messageId: number, content: string) {
      const isCurrent = currentSession.current;
      if (!isCurrent?.()) throw new SessionChangedError();
      const updated = await editChatMessage(friendId, messageId, content);
      if (!isCurrent()) throw new SessionChangedError();
      merge([updated]);
      void queryClient.invalidateQueries({ queryKey: chatKeys.all(me) });
    },
    async deleteMessage(messageId: number) {
      const isCurrent = currentSession.current;
      if (!isCurrent?.()) throw new SessionChangedError();
      const removed = await deleteChatMessage(friendId, messageId);
      if (!isCurrent()) throw new SessionChangedError();
      merge([removed]);
      void queryClient.invalidateQueries({ queryKey: chatKeys.all(me) });
    },
  };
}

/**
 * The composer's send: one request at a time, only for valid content and a partner the user may
 * message (`canSend`). Resolves true once sent, so the caller clears its draft.
 */
export function useChatSend(send: (content: string) => Promise<void>, canSend: boolean) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  return {
    busy,
    error,
    async submit(draft: string): Promise<boolean> {
      const content = chatMessageContent(draft);
      if (!content || sending.current || !canSend) return false;
      sending.current = true;
      setBusy(true);
      setError("");
      try {
        await send(content);
        return true;
      } catch (cause) {
        setError(relationError(cause, "메시지를 보내지 못했습니다."));
        return false;
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
  };
}

import { useEffect, useRef, useState } from "react";
import { apiOrigin, getCurrentUserId, subscribeCurrentUserId } from "@/lib/api/client";
import { getChatThreads, getMutualFollowers } from "@/lib/api/social";
import { buildChatInbox, type ChatInboxRow } from "@/features/social/chat-inbox";
import { createChatRefresh } from "@/features/social/chat-refresh";
import { useChatRealtime } from "@/features/social/use-chat-realtime";
import { relationError } from "@/features/profile/profile-relations";

type InboxState = { scope: string; rows: ChatInboxRow[]; loaded: boolean; error: string };

export function useChatInbox(me: number) {
  const origin = apiOrigin();
  const scope = JSON.stringify([origin, me]);
  const [state, setState] = useState<InboxState | null>(null);
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    let active = true;
    const coordinator = createChatRefresh({
      load: async () => {
        const [threads, mutual] = await Promise.all([getChatThreads(), getMutualFollowers()]);
        return buildChatInbox(threads, mutual);
      },
      isCurrent: () => active && getCurrentUserId() === me && apiOrigin() === origin,
      onSuccess: (rows) => setState({ scope, rows, loaded: true, error: "" }),
      onError: (cause) => setState((previous) => ({
        scope,
        rows: previous?.scope === scope ? previous.rows : [],
        loaded: previous?.scope === scope && previous.loaded,
        error: relationError(cause, "대화 목록을 불러오지 못했습니다."),
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
      unsubscribe();
      window.removeEventListener("focus", coordinator.request);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me, origin, scope]);
  const connected = useChatRealtime(me, () => refresh.current?.(), () => refresh.current?.());
  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => refresh.current?.(), 3000);
    return () => window.clearInterval(timer);
  }, [connected, scope]);
  const current = state?.scope === scope ? state : null;
  return {
    rows: current?.rows ?? [],
    loaded: current?.loaded ?? false,
    error: current?.error ?? "",
    connected,
    refresh: () => refresh.current?.(),
  };
}

import { useEffect, useRef, useState } from "react";
import { apiOrigin, getCurrentUserId, subscribeCurrentUserId } from "@/lib/api/client";
import { getChatThreads, getMutualFollowers, type ChatThread, type Person } from "@/lib/api/social";
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
    let threads: ChatThread[] | null = null;
    let mutual: Person[] = [];
    const isCurrent = () => active && getCurrentUserId() === me && apiOrigin() === origin;
    const publish = () => {
      if (threads) setState((previous) => ({
        scope, rows: buildChatInbox(threads ?? [], mutual), loaded: true,
        error: previous?.scope === scope ? previous.error : "",
      }));
    };
    const coordinator = createChatRefresh({
      load: getChatThreads,
      isCurrent,
      onSuccess: (value) => {
        threads = value;
        setState({ scope, rows: buildChatInbox(threads, mutual), loaded: true, error: "" });
      },
      onError: (cause) => setState((previous) => ({
        scope,
        rows: previous?.scope === scope ? previous.rows : [],
        loaded: previous?.scope === scope && previous.loaded,
        error: relationError(cause, "대화 목록을 불러오지 못했습니다."),
      })),
    });
    const contacts = createChatRefresh({
      load: getMutualFollowers,
      isCurrent,
      onSuccess: (value) => {
        mutual = value;
        publish();
      },
      onError: () => {
        // Keep the last known contacts; the conversation list can still refresh.
      },
    });
    const refreshOnFocus = () => {
      coordinator.request();
      contacts.request();
    };
    const contactsTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") contacts.request();
    }, 60_000);
    refresh.current = coordinator.request;
    const unsubscribe = subscribeCurrentUserId(() => {
      if (getCurrentUserId() !== me) {
        active = false;
        coordinator.dispose();
        contacts.dispose();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOnFocus();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", onVisible);
    refreshOnFocus();
    return () => {
      active = false;
      coordinator.dispose();
      contacts.dispose();
      window.clearInterval(contactsTimer);
      refresh.current = null;
      unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
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

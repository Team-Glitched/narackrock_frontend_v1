import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCurrentUserId } from "@/lib/api/client";
import { markChatRead } from "@/lib/api/social";
import { chatKeys } from "./chat-queries";

export function useMarkChatRead(
  userId: number,
  friendId: number,
  throughId: number | undefined,
  receivedCount: number,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (throughId === undefined || receivedCount === 0) return;
    let pending = false;
    let complete = false;

    const mark = () => {
      if (pending || complete || document.visibilityState !== "visible" || getCurrentUserId() !== userId) return;
      pending = true;
      void markChatRead(friendId, throughId).then(() => {
        complete = true;
        if (getCurrentUserId() === userId) {
          void queryClient.invalidateQueries({ queryKey: chatKeys.all(userId) });
        }
      }).catch(() => {
        // Retry when the tab regains focus or the network comes back.
      }).finally(() => { pending = false; });
    };

    mark();
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("focus", mark);
    window.addEventListener("online", mark);
    return () => {
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("focus", mark);
      window.removeEventListener("online", mark);
    };
    // The count also changes if a lower message ID arrives after a higher ID.
  }, [queryClient, userId, friendId, throughId, receivedCount]);
}

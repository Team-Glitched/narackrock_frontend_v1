import { useEffect, useState } from "react";
import { relationError } from "@/features/profile/profile-relations";
import { apiOrigin } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api/contracts";
import { getProfile } from "@/lib/api/profile";

/** The loaded partner profile, or why it could not be loaded. */
export type ChatPartner = { key: string; profile?: UserProfile; error?: string };

/**
 * The profile of the chat partner `friendId` (`partner` is null while it loads). `key` changes with
 * the API, the account and the partner; the inbox and conversation state is keyed by it.
 */
export function useChatPartner(me: number | null, friendId: number | null) {
  const [friend, setFriend] = useState<ChatPartner | null>(null);
  const key = JSON.stringify([apiOrigin(), me, friendId]);
  useEffect(() => {
    if (me === null || friendId === null) return;
    let active = true;
    getProfile(friendId)
      .then((profile) => {
        if (active) setFriend({ key, profile });
      })
      .catch((cause) => {
        if (active)
          setFriend({ key, error: relationError(cause, "대화 상대를 불러오지 못했습니다.") });
      });
    return () => {
      active = false;
    };
  }, [friendId, key, me]);
  return { key, partner: friend?.key === key ? friend : null };
}

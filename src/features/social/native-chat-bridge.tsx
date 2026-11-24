import { useCallback, useEffect, useRef, useState } from "react";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { relativeTime } from "@/features/posts/post-utils";
import type { UserProfile } from "@/lib/api/contracts";
import { apiOrigin } from "@/lib/api/client";
import type {
  NativeChatConversation,
  NativeChatInbox,
  NativeChatThread,
} from "@/lib/native-screens";
import { relationError } from "@/features/profile/profile-relations";
import { canSendChatTo } from "./chat-access";
import { filterChatInbox } from "./chat-inbox";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatMessageContent,
  isChatMessageDeleted,
} from "./chat-messages";
import { useChatInbox } from "./use-chat-inbox";
import { useChatPartner } from "./use-chat-partner";
import { useChatSend, useConversation } from "./use-conversation";

/** The page's chat navigation, the same handlers the web ChatScreen gets. */
type ChatNavigation = {
  friendId: number | null;
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onSelect: (id: number) => void;
  onProfile: (id: number) => void;
};

/**
 * Hands a child's model and controls to the screen bridge. The inbox and conversation hooks live in
 * children mounted only when they apply (as on the web), so each bridge keeps one native screen.
 */
function useLifted<M, C>() {
  const [model, setModel] = useState<M | null>(null);
  const controls = useRef<C | null>(null);
  const lift = useCallback((next: M | null, nextControls: C | null) => {
    controls.current = nextControls;
    setModel((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, []);
  return { model, controls, lift };
}

/** Reports a child's model up on every render; clears it on unmount. */
function useLift<M, C>(model: M, controls: C, lift: (model: M | null, controls: C | null) => void) {
  useEffect(() => lift(model, controls));
  useEffect(() => () => lift(null, null), [lift]);
}

type InboxState = Omit<NativeChatInbox, "signedOut" | "query">;
type InboxControls = { refresh: () => void };

function InboxModel({
  me,
  query,
  lift,
}: {
  me: number;
  query: string;
  lift: (model: InboxState | null, controls: InboxControls | null) => void;
}) {
  const inbox = useChatInbox(me);
  const rows = filterChatInbox(inbox.rows, query);
  useLift<InboxState, InboxControls>(
    {
      loading: !inbox.loaded && !inbox.error,
      error: inbox.error
        ? inbox.loaded
          ? "목록을 갱신하지 못했습니다. 이전 대화를 표시합니다."
          : inbox.error
        : null,
      reconnecting: inbox.loaded && !inbox.connected,
      rows: rows.map(({ userId, nickname, profileImageUrl, latest }) => ({
        userId,
        nickname,
        profileImageUrl,
        preview: latest
          ? `${latest.outgoing ? "나: " : ""}${latest.lastMessage}`
          : "새 대화 시작하기",
        time: latest ? relativeTime(latest.lastMessageAt) : null,
        unreadCount: latest?.unreadCount ?? 0,
      })),
      empty:
        inbox.loaded && !inbox.error && rows.length === 0
          ? query.trim()
            ? "검색한 대화 상대가 없습니다."
            : "아직 대화가 없습니다."
          : null,
    },
    { refresh: inbox.refresh },
    lift,
  );
  return null;
}

const inboxLoading: InboxState = {
  loading: true,
  error: null,
  reconnecting: false,
  rows: [],
  empty: null,
};

/** /chat in the app: the inbox (native/screens/chat/inbox.tsx). */
function NativeChatInboxBridge({ nav }: { nav: ChatNavigation }) {
  const me = useCurrentUserId();
  const { requestLogin } = useLoginPrompt();
  const { key } = useChatPartner(me, null);
  const { model: lifted, controls, lift } = useLifted<InboxState, InboxControls>();
  const model: NativeChatInbox =
    me === null
      ? { signedOut: true, query: nav.query, ...inboxLoading, loading: false }
      : { signedOut: false, query: nav.query, ...(lifted ?? inboxLoading) };
  const node = useNativeScreen("chat-inbox", model, {
    header: null,
    onBack: nav.onBack,
    onSearch: nav.onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "chat-query":
          return nav.onQueryChange(action.value);
        case "chat-open":
          return nav.onSelect(action.userId);
        case "chat-retry":
          return controls.current?.refresh();
        case "sign-in":
          return requestLogin();
      }
    },
  });
  return (
    <>
      {me !== null && <InboxModel key={key} me={me} query={nav.query} lift={lift} />}
      {node}
    </>
  );
}

type ThreadControls = {
  send: (text: string) => void;
  edit: (messageId: number, text: string) => void;
  remove: (messageId: number) => void;
  older: () => void;
  retry: () => void;
};

function ThreadModel({
  me,
  friend,
  lift,
}: {
  me: number;
  friend: UserProfile;
  lift: (model: NativeChatThread | null, controls: ThreadControls | null) => void;
}) {
  const chat = useConversation(me, friend.userId);
  const canSend = canSendChatTo(friend);
  const composer = useChatSend(chat.send, canSend);
  const [sent, setSent] = useState(0);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationNotice, setMutationNotice] = useState("");
  useLift<NativeChatThread, ThreadControls>(
    {
      loading: !chat.loaded,
      error: chat.error || null,
      reconnecting: chat.loaded && !chat.connected,
      older: chat.loaded && chat.hasOlder && chat.messages.length >= 50,
      messages: chat.messages.map((message) => ({
        id: message.id,
        outgoing: message.senderId === me,
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        deleted: isChatMessageDeleted(message),
      })),
      composer: {
        enabled: canSend && !mutationBusy,
        busy: composer.busy || mutationBusy,
        notice:
          mutationNotice ||
          composer.error ||
          (canSend ? null : "비공개 계정에는 맞팔로우한 뒤 메시지를 보낼 수 있습니다."),
        sent,
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
      },
    },
    {
      send: (text) => {
        setMutationNotice("");
        void composer.submit(text).then((done) => {
          if (done) setSent((count) => count + 1);
        });
      },
      edit: (messageId, text) => {
        const clean = chatMessageContent(text);
        if (!clean || mutationBusy) return;
        setMutationBusy(true);
        setMutationNotice("");
        void chat
          .editMessage(messageId, clean)
          .then(() => {
            setSent((count) => count + 1);
          })
          .catch((cause) => {
            setMutationNotice(relationError(cause, "메시지를 수정하지 못했습니다."));
          })
          .finally(() => setMutationBusy(false));
      },
      remove: (messageId) => {
        if (mutationBusy) return;
        setMutationBusy(true);
        setMutationNotice("");
        void chat
          .deleteMessage(messageId)
          .catch((cause) => {
            setMutationNotice(relationError(cause, "메시지를 삭제하지 못했습니다."));
          })
          .finally(() => setMutationBusy(false));
      },
      older: () => void chat.loadOlder(),
      retry: chat.refresh,
    },
    lift,
  );
  return null;
}

/** /chat?userId= in the app: a conversation (native/screens/chat/conversation.tsx). */
function NativeChatConversationBridge({
  friendId,
  nav,
}: {
  friendId: number;
  nav: ChatNavigation;
}) {
  const me = useCurrentUserId();
  const { requestLogin } = useLoginPrompt();
  const { key, partner } = useChatPartner(me, friendId);
  const { model: thread, controls, lift } = useLifted<NativeChatThread, ThreadControls>();
  const profile = partner?.profile;
  const model: NativeChatConversation = {
    signedOut: me === null,
    partner: profile
      ? {
          userId: profile.userId,
          nickname: profile.nickname,
          profileImageUrl: profile.profileImageUrl,
          instrument: profile.primaryInstrument ?? "",
        }
      : null,
    opening: me !== null && partner === null,
    openError: me !== null && partner && !profile ? (partner.error ?? "") : null,
    thread: me !== null && profile ? thread : null,
  };
  const node = useNativeScreen("chat-conversation", model, {
    header: null,
    onBack: nav.onBack,
    onSearch: nav.onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "chat-send":
          return controls.current?.send(action.text);
        case "chat-edit":
          return controls.current?.edit(action.messageId, action.text);
        case "chat-delete":
          return controls.current?.remove(action.messageId);
        case "chat-older":
          return controls.current?.older();
        case "chat-retry":
          return controls.current?.retry();
        case "chat-partner":
          if (profile) nav.onProfile(profile.userId);
          return;
        case "sign-in":
          return requestLogin();
      }
    },
  });
  return (
    <>
      {me !== null && profile && <ThreadModel key={key} me={me} friend={profile} lift={lift} />}
      {node}
    </>
  );
}

/**
 * In the app /chat is drawn natively instead of the web ChatScreen: the inbox, or the conversation
 * with `friendId`. Data, realtime delivery and sends stay here, with the web's own hooks.
 */
export function NativeChatBridge(nav: ChatNavigation) {
  const me = useCurrentUserId();
  const key = JSON.stringify([apiOrigin(), me, nav.friendId]);
  return nav.friendId === null ? (
    <NativeChatInboxBridge key={key} nav={nav} />
  ) : (
    <NativeChatConversationBridge key={key} friendId={nav.friendId} nav={nav} />
  );
}

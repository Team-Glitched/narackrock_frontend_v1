/** Native screen types of the chat feature; registered in ./index.ts. */

/** A row of the chat inbox: a conversation, or a mutual follower without messages yet. */
export type NativeChatInboxRow = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  /** The last message ("나: …" when it is the user's own), or "새 대화 시작하기". */
  preview: string;
  /** Relative time of the last message; null without messages. */
  time: string | null;
  /** Unread messages; above 0 the row is bold with a dot. */
  unreadCount: number;
};

/** /chat: the conversation list (the web's Inbox in src/features/social/chat-screen.tsx). */
export type NativeChatInbox = {
  /** "채팅은 로그인 후 사용할 수 있습니다." with a login button instead of the list. */
  signedOut: boolean;
  /** The search text of the URL (`q`); rows are already filtered by it. */
  query: string;
  /** First load in progress (skeleton row). */
  loading: boolean;
  /** Load or refresh failure with "다시 시도" (`chat-retry`); rows may still show. */
  error: string | null;
  /** The realtime connection dropped; the list is polled. */
  reconnecting: boolean;
  rows: NativeChatInboxRow[];
  /** Message in place of an empty list. */
  empty: string | null;
};

export type NativeChatInboxAction =
  /** Search text, sent after a short pause as on the web; "" clears it. */
  | { type: "chat-query"; value: string }
  | { type: "chat-open"; userId: number }
  | { type: "chat-retry" }
  | { type: "sign-in" };

export type NativeChatMessage = {
  id: number;
  outgoing: boolean;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
};

/** The messages and composer of an open conversation. */
export type NativeChatThread = {
  /** "대화를 불러오는 중..." */
  loading: boolean;
  /** Load/paging failure with "다시 시도" (`chat-retry`). */
  error: string | null;
  /** The realtime connection dropped; messages are polled every 3 seconds. */
  reconnecting: boolean;
  /** Shows "이전 메시지 더보기" (`chat-older`). */
  older: boolean;
  /** Oldest first, as the web lists them. */
  messages: NativeChatMessage[];
  composer: {
    /** The partner accepts messages from the user (chat-access.ts). */
    enabled: boolean;
    /** A message is being sent; the send button is disabled. */
    busy: boolean;
    /** Send failure, or why the user cannot message this partner. */
    notice: string | null;
    /** Messages sent; the composer clears its draft when this moves. */
    sent: number;
    maxLength: number;
  };
  /**
   * The "메시지를 삭제할까요?" dialog; null while closed. It stays open while deleting. `busy` is any
   * edit or delete in flight ("삭제 중...", buttons disabled); `error` is the failed delete.
   */
  confirmDelete: { busy: boolean; error: string | null } | null;
};

/** /chat?userId=: a conversation (the web's Conversation in src/features/social/chat-screen.tsx). */
export type NativeChatConversation = {
  signedOut: boolean;
  /** The partner in the top bar; null shows "채팅". */
  partner: {
    userId: number;
    nickname: string;
    profileImageUrl: string | null;
    instrument: string;
  } | null;
  /** The partner is loading: "대화를 여는 중..." */
  opening: boolean;
  /** The partner could not be loaded. */
  openError: string | null;
  /** Null until the partner is loaded. */
  thread: NativeChatThread | null;
};

export type NativeChatConversationAction =
  | { type: "chat-send"; text: string }
  | { type: "chat-edit"; messageId: number; text: string }
  /** "삭제" in the message options: opens the delete dialog. */
  | { type: "chat-delete-ask"; messageId: number }
  /** "삭제" in the dialog. */
  | { type: "chat-delete" }
  /** "취소" or a tap outside the dialog; ignored while busy. */
  | { type: "chat-delete-cancel" }
  /** The message options opened or the edit was cancelled: the web clears its action error. */
  | { type: "chat-clear-notice" }
  | { type: "chat-older" }
  | { type: "chat-retry" }
  /** The partner in the top bar: their profile. */
  | { type: "chat-partner" }
  | { type: "sign-in" };

export type ChatScreens = {
  "chat-inbox": { model: NativeChatInbox; action: NativeChatInboxAction };
  "chat-conversation": { model: NativeChatConversation; action: NativeChatConversationAction };
};

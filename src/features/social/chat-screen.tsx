import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { profileStyles } from "@/styles/profile.styles";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { relationError } from "@/features/profile/profile-relations";
import { filterChatInbox } from "@/features/social/chat-inbox";
import { useChatInbox } from "@/features/social/use-chat-inbox";
import { canSendChatTo } from "@/features/social/chat-access";
import { useConversation } from "@/features/social/use-conversation";
import { getProfile } from "@/lib/api/profile";
import { apiOrigin } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api/contracts";
import { CHAT_MESSAGE_MAX_LENGTH, chatMessageContent } from "@/features/social/chat-messages";

function Inbox({ me, query, searchOpen, focusRequest, onQueryChange, onSelect }: {
  me: number;
  query: string;
  searchOpen: boolean;
  focusRequest: number;
  onQueryChange: (query: string) => void;
  onSelect: (id: number) => void;
}) {
  const inbox = useChatInbox(me);
  const input = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState(query);
  // Back/forward or an external query change replaces the typed text.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (syncedQuery !== query) {
    setSyncedQuery(query);
    setSearchText(query);
  }
  useEffect(() => {
    if (searchText === query) return;
    // Keep typing local; replacing the URL for every key can race controlled input updates.
    const timer = window.setTimeout(() => onQueryChange(searchText), 150);
    return () => window.clearTimeout(timer);
  }, [searchText, query, onQueryChange]);
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen, focusRequest]);
  const rows = filterChatInbox(inbox.rows, searchText);
  return (
    <>
      {searchOpen && (
        <div className="flex items-center gap-2 p-3">
          <input
            ref={input}
            type="search"
            aria-label="대화 상대 검색"
            placeholder="대화 상대 검색"
            value={searchText}
            className="min-w-0 flex-1 rounded border border-current px-3 py-2"
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button type="button" disabled={!searchText} onClick={() => {
            setSearchText("");
            onQueryChange("");
            input.current?.focus();
          }}>지우기</button>
        </div>
      )}
      {inbox.error && (
        <div role="alert">
          <p>{inbox.loaded ? `목록을 갱신하지 못했습니다. 이전 목록을 표시합니다. ${inbox.error}` : inbox.error}</p>
          <button type="button" onClick={inbox.refresh}>다시 시도</button>
        </div>
      )}
      {!inbox.loaded && !inbox.error && <p role="status">대화 목록을 불러오는 중...</p>}
      {inbox.loaded && !inbox.connected && <p role="status">실시간 연결이 끊겨 3초마다 대화 목록을 확인합니다.</p>}
      {inbox.loaded && rows.length === 0 && (
        <p>{searchText.trim() ? "검색한 대화 상대가 없습니다." : "아직 대화가 없습니다. 맞팔로우한 친구와 대화를 시작해보세요."}</p>
      )}
      <ul className={profileStyles.profilePeopleList} aria-label="대화 목록">
        {rows.map((row) => (
          <li key={row.userId}>
            <button onClick={() => onSelect(row.userId)}>
              <Avatar src={row.profileImageUrl} />
              <span>
                <strong>{row.nickname}</strong>
                <small>{row.latest ? `${row.latest.outgoing ? "나: " : ""}${row.latest.lastMessage}` : "새 대화 시작하기"}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Conversation({ me, friend }: { me: number; friend: UserProfile }) {
  const chat = useConversation(me, friend.userId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const canSend = canSendChatTo(friend);
  const lastId = chat.messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lastId]);
  return (
    <>
      <div className={socialStyles.chatMessages} aria-label="대화 내용" aria-live="polite">
        {!chat.connected && chat.loaded && <p role="status">실시간 연결이 끊겨 3초마다 새 메시지를 확인합니다.</p>}
        {chat.error && <p role="alert">{chat.error} <button onClick={chat.refresh}>다시 시도</button></p>}
        {chat.loaded && chat.hasOlder && chat.messages.length >= 50 && (
          <button className={communityStyles.nrCommentsMore} onClick={() => void chat.loadOlder()}>
            이전 메시지 더보기
          </button>
        )}
        {!chat.loaded && <p role="status">대화를 불러오는 중...</p>}
        {chat.messages.map((message) =>
          message.senderId === me ? (
            <p className={cn(socialStyles.chatBubble, sharedStyles.outgoing, "whitespace-pre-wrap break-words")} key={message.id} data-message-id={message.id}>
              {message.content}
            </p>
          ) : (
            <div className={socialStyles.chatIncoming} key={message.id} data-message-id={message.id}>
              <Avatar src={friend.profileImageUrl} />
              <p className={cn(socialStyles.chatBubble, "whitespace-pre-wrap break-words")}>{message.content}</p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        className={communityStyles.commentComposer}
        onSubmit={async (event) => {
          event.preventDefault();
          const content = chatMessageContent(draft);
          if (!content || sending.current || !canSend) return;
          sending.current = true;
          setBusy(true);
          setSendError("");
          try {
            await chat.send(content);
            setDraft("");
          } catch (cause) {
            setSendError(relationError(cause, "메시지를 보내지 못했습니다."));
          } finally {
            sending.current = false;
            setBusy(false);
          }
        }}
      >
        {(sendError || !canSend) && (
          <p role="alert">{sendError || "비공개 계정에는 맞팔로우한 뒤 메시지를 보낼 수 있습니다."}</p>
        )}
        <div className={communityStyles.commentInputRow}>
          <span className={communityStyles.commentAttachment} aria-hidden="true">
            <i />
            <i />
          </span>
          <textarea
            rows={1}
            aria-label="메시지"
            placeholder="입력"
            value={draft}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button aria-label="메시지 보내기" disabled={!chatMessageContent(draft) || busy || !canSend}>
            <Asset name="comment-send.svg" />
          </button>
        </div>
      </form>
    </>
  );
}

export function ChatScreen({
  friendId,
  onBack,
  onSearch,
  onNotifications,
  onSelect,
  onProfile,
  query,
  onQueryChange,
}: {
  friendId: number | null;
  onBack: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onSelect: (id: number) => void;
  onProfile: (id: number) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const me = useCurrentUserId();
  const [friend, setFriend] = useState<{ key: string; profile?: UserProfile; error?: string } | null>(null);
  const [search, setSearch] = useState({ open: false, request: 0 });
  const key = JSON.stringify([apiOrigin(), me, friendId]);
  useEffect(() => {
    if (me === null || friendId === null) return;
    let active = true;
    getProfile(friendId)
      .then((profile) => {
        if (active) setFriend({ key, profile });
      })
      .catch((cause) => {
        if (active) setFriend({ key, error: relationError(cause, "대화 상대를 불러오지 못했습니다.") });
      });
    return () => {
      active = false;
    };
  }, [friendId, key, me]);
  const current = friend?.key === key ? friend : null;
  return (
    <div className={socialStyles.chatScreen}>
      <header className={socialStyles.chatHeader}>
        <button aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
        {current?.profile ? (
          <button className={socialStyles.chatRecipient} onClick={() => onProfile(current.profile!.userId)}>
            <Avatar src={current.profile.profileImageUrl} />
            <span>
              <strong>{current.profile.nickname}</strong>
              <small>{current.profile.primaryInstrument ?? ""}</small>
            </span>
          </button>
        ) : (
          <h1>채팅</h1>
        )}
        <button aria-label="알림" onClick={onNotifications}>
          <Asset name="bell.svg" />
        </button>
        <button aria-label={friendId === null ? "대화 상대 검색" : "검색"} onClick={friendId === null ? () => {
          setSearch((previous) => ({ open: true, request: previous.request + 1 }));
        } : onSearch}>
          <Asset name="search.svg" />
        </button>
      </header>
      {me === null ? (
        <SignInRequired>채팅은 로그인 후 사용할 수 있습니다.</SignInRequired>
      ) : friendId === null ? (
        <div className={cn(socialStyles.chatMessages, sharedStyles.scrollContent)}>
          <Inbox key={key} me={me} query={query} searchOpen={search.open || Boolean(query)} focusRequest={search.request} onQueryChange={onQueryChange} onSelect={onSelect} />
        </div>
      ) : !current ? (
        <p role="status">대화를 여는 중...</p>
      ) : current.error || !current.profile ? (
        <p role="alert">{current.error}</p>
      ) : (
        <Conversation key={key} me={me} friend={current.profile} />
      )}
    </div>
  );
}

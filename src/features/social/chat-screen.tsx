import { NotificationBell } from "@/features/notifications/notification-bell";
import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { ChevronLeft, Search, SquarePen, X } from "lucide-react";
import { relativeTime } from "@/features/posts/post-utils";
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

function Inbox({ me, query, onQueryChange, onSelect }: {
  me: number;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: number) => void;
}) {
  const inbox = useChatInbox(me);
  const input = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (syncedQuery !== query) {
    setSyncedQuery(query);
    setSearchText(query);
  }
  useEffect(() => {
    if (searchText === query) return;
    const timer = window.setTimeout(() => onQueryChange(searchText), 150);
    return () => window.clearTimeout(timer);
  }, [searchText, query, onQueryChange]);

  const rows = filterChatInbox(inbox.rows, searchText);
  return (
    <>
      <div className="mx-5 mb-3 flex h-11 shrink-0 items-center gap-2.5 rounded-xl bg-app-surface px-3.5 text-app-muted focus-within:ring-2 focus-within:ring-violet-500/60">
        <Search aria-hidden="true" className="size-[17px] shrink-0" />
        <input
          ref={input}
          type="search"
          aria-label="대화 상대 검색"
          placeholder="대화 상대 검색"
          value={searchText}
          className="min-w-0 flex-1 bg-transparent text-body text-app-fg outline-none placeholder:text-app-muted [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => setSearchText(event.target.value)}
        />
        {searchText && (
          <button
            type="button"
            aria-label="검색어 지우기"
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
            onClick={() => { setSearchText(""); onQueryChange(""); input.current?.focus(); }}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div className={cn("min-h-0 flex-1 px-2", sharedStyles.scrollContent)}>
        {inbox.error && (
          <div className="px-3 py-4 text-body text-app-muted" role="alert">
            <p>{inbox.loaded ? "목록을 갱신하지 못했습니다. 이전 대화를 표시합니다." : inbox.error}</p>
            <button type="button" className="mt-2 min-h-9 font-semibold text-app-fg" onClick={inbox.refresh}>다시 시도</button>
          </div>
        )}
        {!inbox.loaded && !inbox.error && <p className="px-3 py-5 text-body text-app-muted" role="status">대화 목록을 불러오는 중...</p>}
        {inbox.loaded && !inbox.connected && <p className="px-3 py-2 text-caption text-app-muted" role="status">실시간 연결이 끊겨 대화 목록을 다시 확인하는 중입니다.</p>}
        {inbox.loaded && rows.length === 0 && (
          <p className="px-3 py-5 text-body text-app-muted">
            {searchText.trim() ? "검색한 대화 상대가 없습니다." : "아직 대화가 없습니다."}
          </p>
        )}
        <ul className="m-0 list-none p-0" aria-label="대화 목록">
          {rows.map((row) => {
            const latest = row.latest;
            const unreadCount = latest?.unreadCount ?? 0;
            return (
              <li key={row.userId}>
                <button
                  type="button"
                  className="grid min-h-[76px] w-full grid-cols-[56px_minmax(0,1fr)_10px] items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 active:bg-white/10"
                  onClick={() => onSelect(row.userId)}
                >
                  <Avatar src={row.profileImageUrl} className="size-14 border-0" />
                  <span className="min-w-0">
                    <span className={cn("block truncate text-label", unreadCount > 0 ? "font-bold" : "font-medium")}>
                      {row.nickname}
                    </span>
                    <span className="mt-1 flex min-w-0 items-baseline gap-1.5 text-body">
                      <span className={cn("min-w-0 truncate", unreadCount > 0 ? "font-semibold text-app-fg" : "text-app-muted")}>
                        {latest ? `${latest.outgoing ? "나: " : ""}${latest.lastMessage}` : "새 대화 시작하기"}
                      </span>
                      {latest && (
                        <>
                          <span aria-hidden="true" className="shrink-0 text-caption text-app-muted">·</span>
                          <time dateTime={latest.lastMessageAt} className="shrink-0 text-caption text-app-muted">
                            {relativeTime(latest.lastMessageAt)}
                          </time>
                        </>
                      )}
                    </span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="grid place-items-center">
                      <span aria-hidden="true" className="size-2.5 rounded-full bg-violet-500" />
                      <span className="sr-only">읽지 않은 메시지 {unreadCount}개</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
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
  onNewMessage,
  onNotifications,
  onSelect,
  onProfile,
  query,
  onQueryChange,
}: {
  friendId: number | null;
  onBack: () => void;
  onSearch: () => void;
  onNewMessage: () => void;
  onNotifications: () => void;
  onSelect: (id: number) => void;
  onProfile: (id: number) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const me = useCurrentUserId();
  const [friend, setFriend] = useState<{ key: string; profile?: UserProfile; error?: string } | null>(null);
  const isInbox = friendId === null;
  const inboxControl = "grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/5";
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
      <header className={isInbox ? "flex h-16 shrink-0 items-center gap-2 px-3" : socialStyles.chatHeader}>
        <button type="button" aria-label="뒤로" className={isInbox ? inboxControl : undefined} onClick={onBack}>
          {isInbox ? <ChevronLeft aria-hidden="true" className="size-6" /> : <Asset name="return.svg" />}
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
          <h1 className={isInbox ? "min-w-0 flex-1 truncate text-[24px] font-bold" : undefined}>채팅</h1>
        )}
        <NotificationBell className={isInbox ? inboxControl : undefined} onClick={onNotifications} />
        {isInbox ? (
          <button type="button" aria-label="새 메시지" className={inboxControl} onClick={onNewMessage}>
            <SquarePen aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <button type="button" aria-label="검색" onClick={onSearch}>
            <Asset name="search.svg" />
          </button>
        )}
      </header>
      {me === null ? (
        <SignInRequired>채팅은 로그인 후 사용할 수 있습니다.</SignInRequired>
      ) : friendId === null ? (
        <Inbox key={key} me={me} query={query} onQueryChange={onQueryChange} onSelect={onSelect} />
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

import { NotificationBell } from "@/features/notifications/notification-bell";
import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/features/posts/post-utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { shouldSubmitOnEnter, usesTouchKeyboard } from "@/features/comments/submit-on-enter";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { useAuthSession } from "@/features/auth/auth-session";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useChatPartner } from "@/features/social/use-chat-partner";
import { filterChatInbox } from "@/features/social/chat-inbox";
import { useChatInbox } from "@/features/social/use-chat-inbox";
import { canSendChatTo } from "@/features/social/chat-access";
import { useChatSend, useConversation } from "@/features/social/use-conversation";
import type { UserProfile } from "@/lib/api/contracts";
import { CHAT_MESSAGE_MAX_LENGTH, chatMessageContent } from "@/features/social/chat-messages";

const headerControl =
  "grid size-11 shrink-0 place-items-center rounded-full p-[10px] hover:bg-white/5 [&>img]:h-auto [&>img]:w-auto [&>img]:max-h-none [&>img]:max-w-none [&>img]:shrink-0";

function Inbox({
  me,
  query,
  onQueryChange,
  onSelect,
}: {
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
      <label className={socialStyles.chatSearch}>
        <Asset name="search-input.svg" className="size-[19px] shrink-0" />
        <input
          ref={input}
          type="search"
          aria-label="대화 상대 검색"
          placeholder="대화 상대 검색"
          value={searchText}
          className="min-w-0 flex-1 border-0 bg-transparent text-label leading-[22px] text-app-fg outline-none placeholder:text-app-muted focus-visible:outline-none! [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => setSearchText(event.target.value)}
        />
        {searchText && (
          <button
            type="button"
            aria-label="검색어 지우기"
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
            onClick={() => {
              setSearchText("");
              onQueryChange("");
              input.current?.focus();
            }}
          >
            <Asset name="search-close.svg" className="size-[13px]" />
          </button>
        )}
      </label>
      <div className={cn("min-h-0 flex-1 px-2", sharedStyles.scrollContent)}>
        {inbox.error && (
          <div
            className="mx-3 my-2 min-h-[76px] rounded-lg bg-app-surface px-4 py-3 text-body text-app-muted"
            role="alert"
          >
            <p>
              {inbox.loaded ? "목록을 갱신하지 못했습니다. 이전 대화를 표시합니다." : inbox.error}
            </p>
            <button
              type="button"
              className="mt-2 min-h-9 font-semibold text-app-fg"
              onClick={inbox.refresh}
            >
              다시 시도
            </button>
          </div>
        )}
        {!inbox.loaded && !inbox.error && (
          <div
            className="mx-3 my-2 flex min-h-[76px] items-center gap-3 rounded-lg bg-app-surface px-4"
            role="status"
          >
            <span className="sr-only">대화 목록을 불러오는 중...</span>
            <span
              aria-hidden="true"
              className="size-11 shrink-0 rounded-full bg-app-line motion-safe:animate-pulse"
            />
            <span
              aria-hidden="true"
              className="flex flex-1 flex-col gap-2 motion-safe:animate-pulse"
            >
              <span className="h-3 w-20 rounded-full bg-app-line" />
              <span className="h-3 w-36 max-w-full rounded-full bg-app-line" />
            </span>
          </div>
        )}
        {inbox.loaded && !inbox.connected && (
          <p className="px-3 py-2 text-caption text-app-muted" role="status">
            실시간 연결이 끊겨 대화 목록을 다시 확인하는 중입니다.
          </p>
        )}
        {inbox.loaded && !inbox.error && rows.length === 0 && (
          <p className="mx-3 my-2 flex min-h-[76px] items-center rounded-lg bg-app-surface px-4 py-3 text-body text-app-muted">
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
                    <span
                      className={cn(
                        "block truncate text-label",
                        unreadCount > 0 ? "font-bold" : "font-medium",
                      )}
                    >
                      {row.nickname}
                    </span>
                    <span className="mt-1 flex min-w-0 items-baseline gap-1.5 text-body">
                      <span
                        className={cn(
                          "min-w-0 truncate",
                          unreadCount > 0 ? "font-semibold text-app-fg" : "text-app-muted",
                        )}
                      >
                        {latest
                          ? `${latest.outgoing ? "나: " : ""}${latest.lastMessage}`
                          : "새 대화 시작하기"}
                      </span>
                      {latest && (
                        <>
                          <span aria-hidden="true" className="shrink-0 text-caption text-app-muted">
                            ·
                          </span>
                          <time
                            dateTime={latest.lastMessageAt}
                            className="shrink-0 text-caption text-app-muted"
                          >
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
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = canSendChatTo(friend);
  const { busy, error: sendError, submit } = useChatSend(chat.send, canSend);
  const lastId = chat.messages.at(-1)?.id;
  useEffect(() => {
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [lastId]);
  useLayoutEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    const messages = messagesRef.current;
    const atBottom =
      messages !== null &&
      messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 1;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
    // Keep the latest message visible as the composer grows, without moving a reader of older messages.
    if (messages && atBottom) messages.scrollTop = messages.scrollHeight;
  }, [draft]);
  const sendDraft = async () => {
    if (await submit(draft)) {
      // A slow response must not discard edits made since this send started.
      setDraft((current) => (current === draft ? "" : current));
    }
  };
  return (
    <>
      <div
        ref={messagesRef}
        className={socialStyles.chatMessages}
        aria-label="대화 내용"
        aria-live="polite"
      >
        {!chat.connected && chat.loaded && (
          <p role="status">실시간 연결이 끊겨 3초마다 새 메시지를 확인합니다.</p>
        )}
        {chat.error && (
          <div
            role="alert"
            className="flex w-full flex-col items-center justify-center gap-3 py-6 text-center text-body leading-5 text-[#ff8d8d]"
          >
            <p className="m-0">{chat.error}</p>
            <button
              type="button"
              className={buttonVariants({ tone: "secondary", size: "compact" })}
              onClick={chat.refresh}
            >
              다시 시도
            </button>
          </div>
        )}
        {chat.loaded && chat.hasOlder && chat.messages.length >= 50 && (
          <button className={communityStyles.nrCommentsMore} onClick={() => void chat.loadOlder()}>
            이전 메시지 더보기
          </button>
        )}
        {!chat.loaded && <p role="status">대화를 불러오는 중...</p>}
        {chat.messages.map((message) =>
          message.senderId === me ? (
            <p
              className={cn(
                socialStyles.chatBubble,
                sharedStyles.outgoing,
                "whitespace-pre-wrap break-words",
              )}
              key={message.id}
              data-message-id={message.id}
            >
              {message.content}
            </p>
          ) : (
            <div
              className={socialStyles.chatIncoming}
              key={message.id}
              data-message-id={message.id}
            >
              <Avatar src={friend.profileImageUrl} />
              <p className={cn(socialStyles.chatBubble, "whitespace-pre-wrap break-words")}>
                {message.content}
              </p>
            </div>
          ),
        )}
      </div>
      <form
        className={socialStyles.chatComposer}
        onSubmit={async (event) => {
          event.preventDefault();
          await sendDraft();
        }}
      >
        {(sendError || !canSend) && (
          <p role="alert">
            {sendError || "비공개 계정에는 맞팔로우한 뒤 메시지를 보낼 수 있습니다."}
          </p>
        )}
        <div className={socialStyles.chatInputRow}>
          <textarea
            ref={textareaRef}
            rows={1}
            aria-label="메시지"
            placeholder="입력"
            value={draft}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={async (event) => {
              if (!shouldSubmitOnEnter(event.nativeEvent, usesTouchKeyboard())) return;
              event.preventDefault();
              await sendDraft();
            }}
          />
          <button
            type="submit"
            aria-label="메시지 보내기"
            disabled={!chatMessageContent(draft) || busy || !canSend}
          >
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
  onMyProfile,
  onLogin,
  query,
  onQueryChange,
}: {
  friendId: number | null;
  onBack: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onSelect: (id: number) => void;
  onProfile: (id: number) => void;
  onMyProfile: () => void;
  onLogin: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { currentUserId: me, headerProfileImageUrl } = useAuthSession();
  const { key, partner: current } = useChatPartner(me, friendId);
  return (
    <div className={socialStyles.chatScreen}>
      <header className={socialStyles.chatHeader}>
        <button type="button" className={headerControl} aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
        {current?.profile ? (
          <button
            type="button"
            className={socialStyles.chatRecipient}
            onClick={() => onProfile(current.profile!.userId)}
          >
            <Avatar size="md" src={current.profile.profileImageUrl} />
            <span>
              <strong>{current.profile.nickname}</strong>
              {current.profile.primaryInstrument ? (
                <small>{current.profile.primaryInstrument}</small>
              ) : null}
            </span>
          </button>
        ) : (
          <h1 className="m-0 min-w-0 flex-1 truncate pl-1 text-title leading-[26px] font-bold">
            채팅
          </h1>
        )}
        <div className="flex h-11 shrink-0 items-center gap-1">
          <NotificationBell className={headerControl} onClick={onNotifications} />
          <button type="button" className={headerControl} aria-label="검색" onClick={onSearch}>
            <Asset name="v3-search.svg" />
          </button>
          {me === null ? (
            <button
              type="button"
              className={cn(buttonVariants({ tone: "primary", size: "compact" }), "mr-2 shrink-0")}
              onClick={onLogin}
            >
              로그인
            </button>
          ) : (
            <button
              type="button"
              aria-label="프로필"
              className={cn(headerControl, "p-1.5 [&_.avatar]:border-0")}
              onClick={onMyProfile}
            >
              <Avatar size="md" src={headerProfileImageUrl} />
            </button>
          )}
        </div>
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

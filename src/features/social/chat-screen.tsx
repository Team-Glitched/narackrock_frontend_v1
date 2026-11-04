import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { profileStyles } from "@/styles/profile.styles";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/ui/asset";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { relationError } from "@/features/profile/profile-relations";
import { buildChatInbox, type ChatInboxRow } from "@/features/social/chat-inbox";
import { canSendChatTo } from "@/features/social/chat-access";
import { useConversation } from "@/features/social/use-conversation";
import { getProfile } from "@/lib/api/profile";
import { getChatThreads, getMutualFollowers } from "@/lib/api/social";
import type { UserProfile } from "@/lib/api/contracts";

function Inbox({ onSelect }: { onSelect: (id: number) => void }) {
  const userId = useCurrentUserId();
  const [loaded, setLoaded] = useState<{ userId: number | null; rows: ChatInboxRow[]; error?: string } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([getChatThreads(), getMutualFollowers()])
      .then(([threads, mutual]) => {
        if (active) setLoaded({ userId, rows: buildChatInbox(threads, mutual) });
      })
      .catch((cause) => {
        if (active) setLoaded({ userId, rows: [], error: relationError(cause, "대화 목록을 불러오지 못했습니다.") });
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const current = loaded?.userId === userId ? loaded : null;
  if (!current) return <p role="status">대화 목록을 불러오는 중...</p>;
  if (current.error) return <p role="alert">{current.error}</p>;
  if (current.rows.length === 0) return <p>아직 대화가 없습니다. 맞팔로우한 친구와 대화를 시작해보세요.</p>;
  return (
    <ul className={profileStyles.profilePeopleList} aria-label="대화 목록">
      {current.rows.map((row) => (
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
  );
}

function Conversation({ me, friend }: { me: number; friend: UserProfile }) {
  const chat = useConversation(me, friend.userId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const canSend = canSendChatTo(friend);
  const lastId = chat.messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lastId]);
  return (
    <>
      <div className={socialStyles.chatMessages} aria-label="대화 내용" aria-live="polite">
        {!chat.connected && chat.loaded && <p role="status">실시간 연결이 끊겨 3초마다 새 메시지를 확인합니다.</p>}
        {chat.error && <p role="alert">{chat.error}</p>}
        {chat.loaded && chat.hasOlder && chat.messages.length >= 50 && (
          <button className={communityStyles.nrCommentsMore} onClick={() => void chat.loadOlder()}>
            이전 메시지 더보기
          </button>
        )}
        {!chat.loaded && <p role="status">대화를 불러오는 중...</p>}
        {chat.messages.map((message) =>
          message.senderId === me ? (
            <p className={cn(socialStyles.chatBubble, sharedStyles.outgoing)} key={message.id} data-message-id={message.id}>
              {message.content}
            </p>
          ) : (
            <div className={socialStyles.chatIncoming} key={message.id} data-message-id={message.id}>
              <Avatar src={friend.profileImageUrl} />
              <p className={socialStyles.chatBubble}>{message.content}</p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        className={communityStyles.commentComposer}
        onSubmit={async (event) => {
          event.preventDefault();
          const content = draft.trim();
          if (!content || busy || !canSend) return;
          setBusy(true);
          setSendError("");
          try {
            await chat.send(content);
            setDraft("");
          } catch (cause) {
            setSendError(relationError(cause, "메시지를 보내지 못했습니다."));
          } finally {
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
            maxLength={1000}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button aria-label="메시지 보내기" disabled={!draft.trim() || busy || !canSend}>
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
}: {
  friendId: number | null;
  onBack: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onSelect: (id: number) => void;
  onProfile: (id: number) => void;
}) {
  const me = useCurrentUserId();
  const [friend, setFriend] = useState<{ key: string; profile?: UserProfile; error?: string } | null>(null);
  const key = `${me}:${friendId}`;
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
        <button aria-label="검색" onClick={onSearch}>
          <Asset name="search.svg" />
        </button>
      </header>
      {me === null ? (
        <SignInRequired>채팅은 로그인 후 사용할 수 있습니다.</SignInRequired>
      ) : friendId === null ? (
        <div className={cn(socialStyles.chatMessages, sharedStyles.scrollContent)}>
          <Inbox onSelect={onSelect} />
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

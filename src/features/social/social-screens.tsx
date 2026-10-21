"use client";

import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { chatWebSocketUrl, followPerson, getChatMessages, getChatThreads, getFollowers, getFollowing, getMutualFollowers, getOutgoingFollowRequests, getRecommendations, sendChatMessage, unfollowPerson, type ChatMessage, type OutgoingRequest, type Person, type RecommendedPerson } from "@/lib/api/social";
import { ApiError, getAccessToken } from "@/lib/api/client";
import { getProfile } from "@/lib/api/profile";
import { canSendChatTo } from "./chat-access";
import { buildChatInbox, type ChatInboxRow } from "./chat-inbox";
import "./social.css";

function PersonRow({ person, action, onChat, onProfile }: { person: Person; action?: React.ReactNode; onChat?: (person: Person) => void; onProfile?: (person: Person) => void }) {
  return <div className="social-person-row">
    <button className="social-person-identity" onClick={() => onProfile?.(person)}><Avatar src={person.profileImageUrl} />
    <span className="social-person-details"><strong>{person.nickname}</strong><small>{person.primaryInstrument || "악기 미등록"}</small></span></button>
    {onChat && <button className="social-chat-button" onClick={() => onChat(person)}>채팅</button>}
    {action}
  </div>;
}

export function FriendsHome({ onAllMutual, onAllRecommendations, onChat, onProfile, onLogin }: { onAllMutual: () => void; onAllRecommendations: () => void; onChat: (person: Person) => void; onProfile: (person: Person) => void; onLogin: () => void }) {
  const userId = useCurrentUserId();
  const [mutual, setMutual] = useState<Person[]>([]);
  const [recommended, setRecommended] = useState<RecommendedPerson[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (userId == null) return;
    const [friends, suggestions, pending] = await Promise.allSettled([getMutualFollowers(), getRecommendations(0, 5), getOutgoingFollowRequests()]);
    if (friends.status === "fulfilled") setMutual(friends.value);
    if (suggestions.status === "fulfilled") setRecommended(suggestions.value.recommendedUsers);
    if (pending.status === "fulfilled") setOutgoing(pending.value);
    setError(suggestions.status === "rejected" ? "팔로우 추천을 불러오지 못했습니다."
      : friends.status === "rejected" || pending.status === "rejected" ? "일부 친구 정보를 불러오지 못했습니다." : null);
  }, [userId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function toggle(person: RecommendedPerson) {
    if (busy != null) return;
    setBusy(person.userId); setError(null);
    try {
      if (outgoing.some(item => item.targetId === person.userId) || person.isFollowing) await unfollowPerson(person.userId);
      else await followPerson(person.userId);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "팔로우 요청을 처리하지 못했습니다."); }
    finally { setBusy(null); }
  }
  if (userId == null) return <div className="social-friends-empty"><p>친구를 보려면 로그인해 주세요.</p><button className="purple-pill" onClick={onLogin}>로그인</button></div>;
  return <div className="social-friends-home">
    {error && <p role="alert" className="social-error">{error}</p>}
    <section><div className="social-section-heading"><h2>맞팔로우 된 사용자</h2><button onClick={onAllMutual}>모두보기</button></div>
      <div className="social-mutual-rail">{mutual.length ? mutual.slice(0, 8).map(person => <div key={person.userId} className="social-mutual-card">
        <button className="social-mutual-identity" onClick={() => onProfile(person)}><Avatar src={person.profileImageUrl} /><strong>{person.nickname}</strong><small>{person.primaryInstrument || "악기 미등록"}</small></button>
        <button className="social-mutual-chat" onClick={() => onChat(person)}>채팅</button>
      </div>) : <p className="social-empty">아직 맞팔로우한 사용자가 없습니다.</p>}</div></section>
    <section><div className="social-section-heading"><h2>팔로우 추천</h2><button onClick={onAllRecommendations}>모두보기</button></div>
      <div className="social-person-list">{recommended.length ? recommended.map(person => <PersonRow key={person.userId} person={person} onProfile={onProfile} action={<button disabled={busy === person.userId} className="social-follow-button" onClick={() => void toggle(person)}>{outgoing.some(item => item.targetId === person.userId) ? "요청 취소" : person.isFollowing ? "팔로잉" : "팔로우"}</button>} />) : <p className="social-empty">추천할 사용자가 없습니다.</p>}</div></section>
  </div>;
}

export function PeopleListScreen({ kind, onChat, onProfile }: { kind: "mutual" | "recommendations" | "followers" | "following"; onChat: (person: Person) => void; onProfile: (person: Person) => void }) {
  const userId = useCurrentUserId();
  const [filter, setFilter] = useState<"all" | "mutual">("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [mutual, setMutual] = useState<Person[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (userId == null) return;
    const [list, friends, pending] = await Promise.allSettled([
      kind === "mutual" ? getMutualFollowers() : kind === "followers" ? getFollowers(userId) : kind === "following" ? getFollowing(userId) : getRecommendations(0, 100).then(result => result.recommendedUsers),
      getMutualFollowers(), getOutgoingFollowRequests(),
    ]);
    if (list.status === "fulfilled") setPeople(list.value);
    if (friends.status === "fulfilled") setMutual(friends.value);
    if (pending.status === "fulfilled") setOutgoing(pending.value);
    setError(list.status === "rejected" ? "목록을 불러오지 못했습니다."
      : friends.status === "rejected" || pending.status === "rejected" ? "일부 친구 정보를 불러오지 못했습니다." : null);
  }, [kind, userId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const title = { mutual: "맞팔로우 된 사용자", recommendations: "팔로우 추천", followers: "Follower", following: "Following" }[kind];
  const mutualIds = new Set(mutual.map(person => person.userId));
  const shown = kind === "followers" && filter === "mutual" ? people.filter(person => mutualIds.has(person.userId)) : people;
  async function toggle(person: Person) {
    if (busy != null) return;
    setBusy(person.userId); setError(null);
    try {
      if (outgoing.some(item => item.targetId === person.userId) || kind === "following" || ("isFollowing" in person && person.isFollowing)) await unfollowPerson(person.userId);
      else await followPerson(person.userId);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "팔로우를 처리하지 못했습니다."); }
    finally { setBusy(null); }
  }
  return <div className="social-full-list scroll-content"><h1>{title}</h1>
    {kind === "followers" && <div className="social-segmented" role="group" aria-label="팔로워 필터"><button className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체</button><button className={filter === "mutual" ? "active" : ""} aria-pressed={filter === "mutual"} onClick={() => setFilter("mutual")}>맞팔로우</button></div>}
    {error && <p role="alert" className="social-error">{error}</p>}
    <div className="social-person-list">{shown.length ? shown.map(person => <PersonRow key={person.userId} person={person} onProfile={onProfile} onChat={mutualIds.has(person.userId) ? onChat : undefined} action={kind === "recommendations" || kind === "following" ? <button className="social-follow-button" disabled={busy === person.userId} onClick={() => void toggle(person)}>{outgoing.some(item => item.targetId === person.userId) ? "요청 취소" : kind === "following" || ("isFollowing" in person && person.isFollowing) ? "팔로잉" : "팔로우"}</button> : undefined} />) : <p className="social-empty">표시할 사용자가 없습니다.</p>}</div>
  </div>;
}

function chatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(date);
}

export function ChatInboxScreen({ onChat }: { onChat: (person: Person) => void }) {
  const userId = useCurrentUserId();
  const [rows, setRows] = useState<ChatInboxRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId == null) return;
    let alive = true;
    let connected = false;
    let unavailable = false;
    const load = async () => {
      const [threads, mutual] = await Promise.allSettled([getChatThreads(), getMutualFollowers()]);
      if (!alive) return false;
      unavailable = threads.status === "rejected" && threads.reason instanceof ApiError && threads.reason.status === 404;
      setRows(buildChatInbox(threads.status === "fulfilled" ? threads.value : [], mutual.status === "fulfilled" ? mutual.value : []));
      setError(threads.status === "rejected" ? "최근 대화를 불러오지 못했습니다."
        : mutual.status === "rejected" ? "맞팔로우 목록을 불러오지 못했습니다." : null);
      setLoading(false);
      return threads.status === "fulfilled";
    };
    const client = new Client({
      brokerURL: chatWebSocketUrl(),
      reconnectDelay: 3000,
      connectionTimeout: 8000,
      beforeConnect: () => { client.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` }; },
      onConnect: () => {
        connected = true;
        client.subscribe("/user/queue/chat", () => { void load(); });
        void load();
      },
      onWebSocketClose: () => { connected = false; },
      onStompError: () => { connected = false; },
    });
    const refresh = () => { void load().then(available => { if (alive && available && !client.active) client.activate(); }); };
    refresh();
    const poll = window.setInterval(() => { if (!connected && !unavailable && document.visibilityState === "visible") refresh(); }, 15000);
    const onVisible = () => { if (!unavailable && document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); void client.deactivate(); };
  }, [userId]);

  const shown = rows.filter(row => row.nickname.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="social-inbox scroll-content">
    <h1>채팅</h1>
    <label className="social-inbox-search"><span className="sr-only">대화 상대 검색</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="대화 상대 검색" /></label>
    <h2>메시지</h2>
    {error && <p role="alert" className="social-error">{error}</p>}
    {loading ? <p className="social-empty">대화를 불러오는 중...</p>
      : shown.length ? <div className="social-inbox-list">{shown.map(row => <button key={row.userId} className="social-inbox-row" onClick={() => onChat(row)}>
        <Avatar src={row.profileImageUrl} />
        <span className="social-inbox-person"><strong>{row.nickname}</strong><small>{row.latest ? `${row.latest.outgoing ? "나: " : ""}${row.latest.lastMessage}` : "맞팔로우 · 첫 메시지를 보내보세요"}</small></span>
        {row.latest && <time dateTime={row.latest.lastMessageAt}>{chatTime(row.latest.lastMessageAt)}</time>}
      </button>)}</div>
      : <p className="social-empty">{query ? "검색 결과가 없습니다." : "아직 대화하거나 맞팔로우한 사용자가 없습니다."}</p>}
  </div>;
}

export function ChatConversationScreen({ friend, onBack, onNotifications, onSearch }: { friend: Person; onBack: () => void; onNotifications: () => void; onSearch: () => void }) {
  const userId = useCurrentUserId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void getProfile(friend.userId)
      .then(profile => { if (alive) setCanSend(canSendChatTo(profile)); })
      .catch(() => { if (alive) setCanSend(current => current === false ? false : true); });
    return () => { alive = false; };
  }, [friend.userId]);
  useEffect(() => {
    let alive = true;
    let connected = false;
    let forbidden = false;
    let client: Client | null = null;
    const merge = (items: ChatMessage[]) => setMessages(current => {
      const byId = new Map(current.map(item => [item.id, item]));
      items.forEach(item => byId.set(item.id, item));
      return [...byId.values()].sort((a, b) => a.id - b.id);
    });
    const refresh = async () => {
      try {
        const items = await getChatMessages(friend.userId);
        if (alive) { merge(items); setError(null); }
        return true;
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 403) {
          forbidden = true;
          if (alive) setCanSend(false);
        }
        if (alive) setError(forbidden ? "비공개 계정은 맞팔로우한 경우에만 대화할 수 있습니다." : "대화를 불러오지 못했습니다.");
        return false;
      }
    };
    void refresh().then(allowed => {
      if (!alive || !allowed) return;
      client = new Client({
        brokerURL: chatWebSocketUrl(),
        reconnectDelay: 3000,
        connectionTimeout: 8000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        beforeConnect: () => { client!.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ""}` }; },
        onConnect: () => {
          connected = true;
          client!.subscribe("/user/queue/chat", frame => {
            try {
              const message = JSON.parse(frame.body) as ChatMessage;
              if (alive && userId != null && ((message.senderId === userId && message.recipientId === friend.userId)
                || (message.senderId === friend.userId && message.recipientId === userId))) merge([message]);
            } catch { /* An invalid frame does not replace the REST conversation. */ }
          });
          void refresh();
        },
        onWebSocketClose: () => { connected = false; },
        onStompError: () => { connected = false; },
      });
      client.activate();
    });
    const timer = window.setInterval(() => {
      if (!connected && !forbidden && document.visibilityState === "visible") void refresh();
    }, 3000);
    return () => { alive = false; window.clearInterval(timer); void client?.deactivate(); };
  }, [friend.userId, userId]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || canSend !== true) return;
    setSending(true); setError(null);
    try { const message = await sendChatMessage(friend.userId, content); setMessages(current => [...current.filter(item => item.id !== message.id), message].sort((a, b) => a.id - b.id)); setDraft(""); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) setCanSend(false);
      setError(cause instanceof Error ? cause.message : "메시지를 보내지 못했습니다.");
    }
    finally { setSending(false); }
  }
  return <div className="social-chat scroll-content"><div className="social-chat-heading"><button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button><Avatar src={friend.profileImageUrl} /><span><strong>{friend.nickname}</strong><small>{friend.primaryInstrument}</small></span><div className="social-chat-header-actions"><button aria-label="알림" onClick={onNotifications}><Asset name="bell.svg" /></button><button aria-label="검색" onClick={onSearch}><Asset name="search.svg" /></button></div></div>
    <div className="social-chat-messages" aria-live="polite">{messages.length ? messages.map(message => <div key={message.id} className={message.senderId === userId ? "social-message own" : "social-message"}>{message.senderId !== userId && <Avatar src={friend.profileImageUrl} />}<span>{message.content}</span></div>) : <p className="social-empty">첫 메시지를 보내보세요.</p>}</div>
    {error && <p role="alert" className="social-error">{error}</p>}
    {canSend === false ? <p className="social-chat-readonly">비공개 계정에는 맞팔로우한 경우에만 메시지를 보낼 수 있습니다.</p>
      : <form className="social-chat-compose" onSubmit={event => void send(event)}><input value={draft} maxLength={2000} disabled={canSend !== true} onChange={event => setDraft(event.target.value)} placeholder="메시지를 입력해 주세요" aria-label="메시지" /><button disabled={canSend !== true || !draft.trim() || sending} aria-label="메시지 보내기">➤</button></form>}
  </div>;
}

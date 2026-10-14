"use client";

import { useCallback, useEffect, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { followPerson, getChatMessages, getFollowers, getFollowing, getMutualFollowers, getOutgoingFollowRequests, getRecommendations, sendChatMessage, unfollowPerson, type ChatMessage, type OutgoingRequest, type Person, type RecommendedPerson } from "@/lib/api/social";
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
    const [friends, suggestions, pending] = await Promise.all([getMutualFollowers(), getRecommendations(0, 5), getOutgoingFollowRequests()]);
    setMutual(friends); setRecommended(suggestions.recommendedUsers); setOutgoing(pending);
  }, [userId]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => setError("친구 목록을 불러오지 못했습니다.")); }, [load]);
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
    const [list, friends, pending] = await Promise.all([
      kind === "mutual" ? getMutualFollowers() : kind === "followers" ? getFollowers(userId) : kind === "following" ? getFollowing(userId) : getRecommendations(0, 100).then(result => result.recommendedUsers),
      getMutualFollowers(), getOutgoingFollowRequests(),
    ]);
    setPeople(list); setMutual(friends); setOutgoing(pending);
  }, [kind, userId]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => setError("목록을 불러오지 못했습니다.")); }, [load]);
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

export function ChatConversationScreen({ friend, onBack, onNotifications, onSearch }: { friend: Person; onBack: () => void; onNotifications: () => void; onSearch: () => void }) {
  const userId = useCurrentUserId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => getChatMessages(friend.userId).then(items => { if (alive) setMessages(items); }).catch(() => { if (alive) setError("대화를 불러오지 못했습니다."); });
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [friend.userId]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setError(null);
    try { const message = await sendChatMessage(friend.userId, content); setMessages(current => [...current.filter(item => item.id !== message.id), message]); setDraft(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "메시지를 보내지 못했습니다."); }
    finally { setSending(false); }
  }
  return <div className="social-chat scroll-content"><div className="social-chat-heading"><button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button><Avatar src={friend.profileImageUrl} /><span><strong>{friend.nickname}</strong><small>{friend.primaryInstrument}</small></span><div className="social-chat-header-actions"><button aria-label="알림" onClick={onNotifications}><Asset name="bell.svg" /></button><button aria-label="검색" onClick={onSearch}><Asset name="search.svg" /></button></div></div>
    <div className="social-chat-messages" aria-live="polite">{messages.length ? messages.map(message => <div key={message.id} className={message.senderId === userId ? "social-message own" : "social-message"}>{message.senderId !== userId && <Avatar src={friend.profileImageUrl} />}<span>{message.content}</span></div>) : <p className="social-empty">첫 메시지를 보내보세요.</p>}</div>
    {error && <p role="alert" className="social-error">{error}</p>}
    <form className="social-chat-compose" onSubmit={event => void send(event)}><input value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} placeholder="메시지를 입력해 주세요" aria-label="메시지" /><button disabled={!draft.trim() || sending} aria-label="메시지 보내기">➤</button></form>
  </div>;
}

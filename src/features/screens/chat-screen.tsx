import { useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { isPreviewMode } from "@/features/preview/preview-mode";
const greeting = "오 안녕 친구들? 오 안녕 친구들? 오 안녕 친구들? 오 안녕 친구들?";
export function ChatScreen({ go }: { go: Navigate }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  return <div className="chat-screen">
    <header className="chat-header"><button aria-label="뒤로" onClick={() => go("friends")}><Asset name="return.svg" /></button><button className="chat-recipient" onClick={() => go("profile",3)}><Avatar /><span><strong>Muhehehe</strong><small>피아노</small></span></button><button aria-label="알림" onClick={() => go("notifications")}><Asset name="bell.svg" /></button><button aria-label="검색" onClick={() => go("search")}><Asset name="search.svg" /></button></header>
    <div className="chat-messages" aria-label="대화 내용">{isPreviewMode() && <><p className="chat-bubble outgoing">{greeting}</p><p className="chat-bubble outgoing">ㅋ</p><div className="chat-incoming"><Avatar /><p className="chat-bubble">{greeting}</p></div></>}{messages.map((message,index) => <p className="chat-bubble outgoing" key={index}>{message}</p>)}</div>
    <form className="comment-composer" onSubmit={event => { event.preventDefault(); if (draft.trim() && isPreviewMode()) { setMessages(current => [...current,draft.trim()]); setDraft(""); } }}><div className="comment-input-row"><span className="comment-attachment" aria-hidden="true"><i /><i /></span><textarea rows={1} aria-label="메시지" placeholder="입력" value={draft} onChange={event => setDraft(event.target.value)} /><button aria-label="메시지 보내기" disabled={!draft.trim() || !isPreviewMode()}><Asset name="comment-send.svg" /></button></div></form>
  </div>;
}

import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { isPreviewMode } from "@/features/preview/preview-mode";
const greeting = "오 안녕 친구들? 오 안녕 친구들? 오 안녕 친구들? 오 안녕 친구들?";
export function ChatScreen({ go }: { go: Navigate }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  return <div className={socialStyles.chatScreen}>
    <header className={socialStyles.chatHeader}><button aria-label="뒤로" onClick={() => go("friends")}><Asset name="return.svg" /></button><button className={socialStyles.chatRecipient} onClick={() => go("profile",3)}><Avatar /><span><strong>Muhehehe</strong><small>피아노</small></span></button><button aria-label="알림" onClick={() => go("notifications")}><Asset name="bell.svg" /></button><button aria-label="검색" onClick={() => go("search")}><Asset name="search.svg" /></button></header>
    <div className={socialStyles.chatMessages} aria-label="대화 내용">{isPreviewMode() && <><p className={cn(socialStyles.chatBubble, sharedStyles.outgoing)}>{greeting}</p><p className={cn(socialStyles.chatBubble, sharedStyles.outgoing)}>ㅋ</p><div className={socialStyles.chatIncoming}><Avatar /><p className={socialStyles.chatBubble}>{greeting}</p></div></>}{messages.map((message,index) => <p className={cn(socialStyles.chatBubble, sharedStyles.outgoing)} key={index}>{message}</p>)}</div>
    <form className={communityStyles.commentComposer} onSubmit={event => { event.preventDefault(); if (draft.trim() && isPreviewMode()) { setMessages(current => [...current,draft.trim()]); setDraft(""); } }}><div className={communityStyles.commentInputRow}><span className={communityStyles.commentAttachment} aria-hidden="true"><i /><i /></span><textarea rows={1} aria-label="메시지" placeholder="입력" value={draft} onChange={event => setDraft(event.target.value)} /><button aria-label="메시지 보내기" disabled={!draft.trim() || !isPreviewMode()}><Asset name="comment-send.svg" /></button></div></form>
  </div>;
}

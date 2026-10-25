"use client";

import { IconSlot } from "./shared";
import "./post-actions.css";

export type PostVote = "like" | "dislike" | null;

/** The same reaction controls for community posts and open-source posts. */
export function PostActions({likeCount,commentCount,vote,onVote,onComments,saved=false,onSave,compact=false,readOnly=false,dislikeCount=0}: {
  likeCount:number; commentCount:number; vote:PostVote;
  onVote:(vote:Exclude<PostVote,null>)=>void; onComments:()=>void;
  saved?:boolean; onSave?:()=>void; compact?:boolean; readOnly?:boolean; dislikeCount?:number;
}) {
  if(readOnly) return <div className="post-readonly-stats" aria-label="게시글 통계">
    <span><IconSlot name="like.svg" kind="mini"/>{likeCount}</span>
    <span><IconSlot name="mini-dislike.svg" kind="mini"/>{dislikeCount}</span>
    <span><IconSlot name="mini-comment.svg" kind="mini"/>{commentCount}</span>
  </div>;
  return <div className={`post-actions${compact?" post-actions--compact":""}`}>
    <div className="post-actions-vote" role="group" aria-label="게시글 반응">
      <button onClick={()=>onVote("like")} aria-label="좋아요" aria-pressed={vote==="like"}><IconSlot name={`v3-post-like-${vote==="like"?"on":"off"}.svg`} kind="post"/>{likeCount+Number(vote==="like")}</button>
      <span className="post-actions-divider" aria-hidden="true"/>
      <button onClick={()=>onVote("dislike")} aria-label="싫어요" aria-pressed={vote==="dislike"}><IconSlot name={`v3-post-dislike-${vote==="dislike"?"on":"off"}.svg`} kind="post"/></button>
    </div>
    <button className="post-actions-comments" onClick={onComments} aria-label={`댓글 ${commentCount}개 보기`}><IconSlot name="post-comment.svg" kind="post"/>{commentCount}</button>
    {!compact&&<><span className="post-actions-space"/><button className="post-actions-icon" disabled aria-label="공유 기능 준비 중"><IconSlot name="post-share.svg" kind="post"/></button><button className="post-actions-icon" aria-label="저장" aria-pressed={saved} disabled={!onSave} onClick={onSave}><IconSlot name={`v3-post-save-${saved?"on":"off"}.svg`} kind="post-save"/></button></>}
  </div>;
}

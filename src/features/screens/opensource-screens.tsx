import { useMemo, useState, useSyncExternalStore } from "react";
import { useSourceSave } from "@/features/community/source-save-button";
import { SourceAudioPlayer } from "@/features/community/source-audio-player";
import { PostActions } from "@/components/app/post-actions";
import { Avatar, SectionTitle } from "@/components/app/shared";
import { sourceSnapshot, subscribeSources, type PreviewSource } from "@/features/preview/source-store";
import { CommonComments } from "@/features/comments/common-comments";
import { localCommentAdapter, sampleComments } from "@/features/comments/comment-model";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { popularSources, recommendByAuthor } from "@/features/community/discovery";
import "./opensource-discovery.css";
import { getCurrentUserId } from "@/lib/api/client";
import type { Navigate } from "@/features/navigation/types";

// UI sample screens from PR #21; interactions remain local until an API is connected.
export function OpensourceScreen({ go, onOpen }: { go: Navigate; onOpen?:(id:number,comments?:boolean)=>void }) {
  const sources=useSyncExternalStore(subscribeSources,sourceSnapshot,sourceSnapshot);
  const userId=useCurrentUserId();
  const recommended=recommendByAuthor(sources,source=>source.userId,userId);
  const popular=popularSources(sources);
  function card(source:PreviewSource){return <OpensourcePart key={source.id} source={source}
    onOpen={()=>onOpen?onOpen(source.id):go("opensourceDetail")}
    onProfile={()=>go("profile",source.userId)} onComments={()=>onOpen?onOpen(source.id,true):go("opensourceComments")}/>;}
  return <div className="opensource-view scroll-content os-discovery-sections">
    <section aria-label="오픈소스 인기 차트"><SectionTitle>인기 차트</SectionTitle>
      {popular.length===0?<p className="os-discovery-empty">아직 표시할 오픈소스가 없습니다.</p>:<div className="os-discovery-list">{popular.map(source=>card(source))}</div>}
    </section>
    <section aria-label="추천 오픈소스"><SectionTitle>추천 오픈소스</SectionTitle>
      {recommended.length===0?<p className="os-discovery-empty">아직 추천할 오픈소스가 없습니다.</p>:<div className="os-recommend-rail">{recommended.map(source=>card(source))}</div>}
    </section>
  </div>;
}

function OpensourcePart({
  source, onOpen,
  onProfile,
  onComments,
}: {
  source: PreviewSource;
  onOpen?: () => void;
  onProfile?: () => void;
  onComments?: () => void;
}) {
  const saving=useSourceSave(source);
  const saved=saving.saved;
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  return (
    <article className="os-card">
      <div className="os-head">
        <button className="os-author" onClick={onOpen} aria-label="오픈소스 글 보기">
          <Avatar />
          <span>
            <strong>{source.title}</strong>
            <small>사용 수 {(source.usageCount??0).toLocaleString("ko-KR")}</small>
          </span>
        </button>
        <button
          className="purple-pill os-save-button"
          aria-pressed={saved}
          disabled={saving.busy} onClick={()=>void saving.toggle()}
        >
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      {saving.error&&<p role="alert">{saving.error}</p>}
      <button className="os-body" onClick={onOpen}>
        {source.description}
      </button>
      <div className="os-foot">
        <button className="os-foot-author" onClick={onProfile}>
          <Avatar />
          <span>{source.author}</span>
        </button>
        <PostActions compact readOnly dislikeCount={source.dislikeCount??0} likeCount={source.likeCount??0} commentCount={source.commentCount??0} vote={vote} onVote={next=>setVote(current=>current===next?null:next)} onComments={()=>onComments?.()}/>

      </div>
    </article>
  );
}

export function OpensourceDetailScreen({sourceId=1,focusComments=false,onProfile}:{sourceId?:number;focusComments?:boolean;onProfile?:(id:number)=>void}) {
  const sources=useSyncExternalStore(subscribeSources,sourceSnapshot,sourceSnapshot);
  const source=sources.find(item=>item.id===sourceId);
  const saving=useSourceSave(source);const saved=saving.saved;const [vote,setVote]=useState<"like"|"dislike"|null>(null);
  const [focus,setFocus]=useState(focusComments?1:0);
  const preview=isPreviewMode();const me=getCurrentUserId();
  const adapter=useMemo(()=>localCommentAdapter(`opensource:${sourceId}`,preview&&sourceId===1?sampleComments([1,0,0]):[],{id:me??1,name:"나",avatar:"/figma/profile.png"}),[preview,me,sourceId]);
  if(!source)return <div className="profile-state" role="alert">오픈소스를 찾을 수 없습니다. 목록에서 다시 선택해주세요.</div>;
  return <div className="opensource-detail-shell"><CommonComments adapter={adapter} currentUserId={me} canWrite={preview} onProfile={onProfile} focus={focus} header={<div className="opensource-detail">
        <section className="os-detail-article">
        <div className="os-detail-title-row">
          <div className="os-detail-title">
            <Avatar />
            <span><strong>{source.title}</strong><small>사용 수 {(source.usageCount??0).toLocaleString("ko-KR")}</small></span>
          </div>
          <button
            className="purple-pill os-save-button"
            aria-pressed={saved}
            disabled={saving.busy} onClick={()=>void saving.toggle()}
          >{saved ? "저장됨" : "저장"}</button>
        </div>
        {saving.error&&<p role="alert">{saving.error}</p>}
        <div className="os-detail-byline"><Avatar /><span>{source.author}</span></div>
        <p className="os-detail-copy">{source.description}</p>
        <SourceAudioPlayer key={source.id} src={source.mediaUrl}/>
        <PostActions likeCount={source.likeCount??0} commentCount={source.commentCount??0} vote={vote} onVote={next=>setVote(current=>current===next?null:next)} onComments={()=>setFocus(value=>value+1)} saved={saved} onSave={()=>{if(!saving.busy)void saving.toggle();}}/>

        </section><div className="nr-post-comment-divider" /></div>} /></div>;
}

import {SectionTitle} from "@/components/app/shared";
import {ArrowUpRight} from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import {ko} from "date-fns/locale";
import type {Navigate} from "@/features/navigation/types";
import {useWorkspace,type Work} from "./workspace-store";
import {workingMusic} from "./working-music";
import "./home-work-section.css";
function modifiedLabel(value:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?null:formatDistanceToNow(date,{addSuffix:true,locale:ko});
}
/** A small arrangement preview drawn from the draft's actual clips. */
function DraftPreview({work}:{work:Work}){
 const tracks=work.composition.tracks.slice(0,4);
 const end=Math.max(1,...tracks.flatMap(track=>track.clips.map(clip=>clip.startTick+clip.durationTick)));
 return <svg viewBox="0 0 240 88" className="home-draft-arrangement" aria-hidden="true">
  {[0,1,2,3,4,5,6,7,8].map(i=><path key={`v${i}`} d={`M${i*30} 0V88`} className="home-draft-grid"/>)}
  {[0,1,2,3,4].map(i=><path key={`h${i}`} d={`M0 ${i*22}H240`} className="home-draft-grid"/>)}
  {tracks.map((track,row)=><g key={track.trackId} opacity={1-row*.16}>{track.clips.map(clip=><rect key={clip.clipId} x={clip.startTick/end*232+4} y={row*22+5} width={Math.max(3,clip.durationTick/end*232-4)} height={12} rx={3}/>)}</g>)}
 </svg>;
}
export function HomeWorkSection({go,onResume}:{go:Navigate;onResume:(projectId:number,shortId:number|null)=>void}){
 const {works}=useWorkspace();const items=workingMusic(works);
 return <section className="home-working-music"><SectionTitle onAll={items.length?()=>go("workspace"):undefined}>작업 중인 음악</SectionTitle>
  {items.length?<div className="home-work-list" role="group" aria-label="이어서 작곡할 음악">{items.slice(0,3).map(work=>{
   const modified=modifiedLabel(work.updatedAt);
   return <button className="home-work-card" key={work.id} onClick={()=>onResume(work.id,work.shortId)} aria-label={`${work.title} 이어서 작곡하기`}>
    <span className="home-draft-top">{modified?<time dateTime={work.updatedAt}>{modified} 수정</time>:<span>작업 중</span>}<ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true"/></span>
    <DraftPreview work={work}/>
    <span className="home-work-copy"><strong>{work.title}</strong><small>레이어 {work.composition.tracks.length}개<span aria-hidden="true"> · </span>{work.composition.project.bpm} BPM</small></span>
   </button>;
  })}</div>:<div className="home-work-empty"><p>새 곡을 만들거나 음악에 참여해 보세요.</p><button className="purple-pill" onClick={()=>go("studio")}>작곡 시작하기</button></div>}
 </section>;
}

import { workspaceStyles } from "@/styles/workspace.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useSavedSources } from "@/features/community/use-saved-sources";
import { SavedSourceCard } from "@/features/community/saved-source-list";
import { AudioPlaybackBar } from "@/components/app/audio-playback-bar";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Navigate } from "@/features/navigation/types";
import {getComposition, type CompositionDto} from "@/lib/api/composition";
import { compositionDurationMs } from "@/features/composition/playback-duration";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { Asset } from "@/components/app/shared";
import { preserveSubmission, toggleResource, useWorkspace, type Resource, type Submission, type Work } from "./workspace-store";
const labels = { PENDING: "승인 대기", APPROVED: "승인됨", REJECTED: "반려됨" };
function Page({ title, subtitle, children }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
}) { return <section className={cn(workspaceStyles.workspacePage, sharedStyles.scrollContent)}><h1>{title}</h1>{subtitle && <p className={workspaceStyles.workspaceSubtitle}>{subtitle}</p>}{children}</section>; }
function Empty({ children }: {
    children: ReactNode;
}) { return <p className={workspaceStyles.workspaceEmpty}>{children}</p>; }
export function ClipPlayer({ composition, label = "미리듣기" }: {
    composition: CompositionDto;
    label?: string;
}) {
    const player = useCompositionPlayback(composition);
    const id = useId();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const duration = compositionDurationMs(composition);
    const previousVolume=useRef(70);
    const pause = player.pause;
    useEffect(() => {
        const stopOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) pause(); };
        window.addEventListener("narackrock:clip-preview", stopOther);
        return () => window.removeEventListener("narackrock:clip-preview", stopOther);
    }, [id, pause]);
    async function toggle() {
        if (player.playing) { pause(); return; }
        if (loading) return;
        setLoading(true); setError("");
        window.dispatchEvent(new CustomEvent("narackrock:clip-preview", {detail: id}));
        try { await player.play(); }
        catch { setError("재생하지 못했습니다. 다시 시도해주세요."); }
        finally { setLoading(false); }
    }
    return <><AudioPlaybackBar playing={player.playing} muted={player.volume===0} positionMs={player.positionMs} durationMs={duration} onToggle={()=>void toggle()} onSeek={player.seek} onMute={()=>{if(player.volume===0)player.setVolume(previousVolume.current);else{previousVolume.current=player.volume;player.setVolume(0);}}} disabled={duration===0} loading={loading} label={label}/>
    {error && <p role="alert" className={workspaceStyles.workspaceNotice}>{error}</p>}</>;
}

export function WorkspaceScreen({ go, onResume }: {
    go: Navigate;
    onResume: (id: number, shortId: number | null) => void;
}) { const { works } = useWorkspace(); return <Page title={uiLabels.workspace} subtitle="만들던 곡과 참여한 레이어를 이어서 작업하세요."><div className={workspaceStyles.workspaceHeading}><h2>음악 목록</h2><button className={workspaceStyles.workspacePrimary} onClick={() => go("studio")}>새 곡</button></div>{works.length === 0 ? <Empty>아직 작업 중인 곡이 없습니다. 새 곡을 만들거나 숏폼에서 작곡에 참여해보세요.</Empty> : works.map(work => <article className={workspaceStyles.workspaceCard} key={work.id}><span className={workspaceStyles.workspaceStatus}>{work.shortId === null ? uiLabels.myMusic : "참여한 작업"}</span><h2>{work.title}</h2><p>{work.composition.tracks.length}개 레이어 · {work.composition.project.bpm} BPM</p><div className={workspaceStyles.workspaceActions}><button className={workspaceStyles.workspacePrimary} onClick={() => onResume(work.id, work.shortId)}>이어하기</button></div></article>)}</Page>; }
export function SubmissionsScreen({ onSelect }: {
    onSelect: (id: number) => void;
}) { const { submissions } = useWorkspace(); const [filter, setFilter] = useState("ALL"); const mine = submissions.filter(s => s.mine && (filter === "ALL" || s.status === filter)); return <Page title={uiLabels.submissions} subtitle="승인 결과와 내 레이어를 확인하세요."><div className={workspaceStyles.workspaceTabs} role="group" aria-label="제출 상태">{[["ALL", "전체"], ...Object.entries(labels)].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>{mine.length === 0 ? <Empty>해당 상태의 제출 내역이 없습니다.</Empty> : mine.map(item => <button className={cn(workspaceStyles.workspaceCard, workspaceStyles.workspaceCardLink)} key={item.id} onClick={() => onSelect(item.id)}><span className={workspaceStyles.workspaceStatus}>{labels[item.status]}</span><h2>{item.title}</h2><p>{item.description}</p><small>상세 보기 →</small></button>)}</Page>; }
export function ReviewInboxScreen({ onSelect }: {
    onSelect: (id: number) => void;
}) { const { submissions } = useWorkspace(); const items = submissions.filter(s => !s.mine); return <Page title={uiLabels.reviewInbox} subtitle="원곡에 반영하기 전에 추가된 레이어를 들어보세요.">{items.length === 0 ? <Empty>받은 참여 요청이 없습니다.</Empty> : items.map(item => <button className={cn(workspaceStyles.workspaceCard, workspaceStyles.workspaceCardLink)} key={item.id} onClick={() => onSelect(item.id)}><span className={workspaceStyles.workspaceStatus}>{labels[item.status]}</span><h2>{item.title}</h2><p>{item.author} · {item.description}</p><small>레이어 검토 →</small></button>)}</Page>; }
export function SubmissionDetailScreen({id,onResume,onOpenSong}:{id:number;onResume:(id:number,shortId:number|null)=>void;onOpenSong:(shortId:number)=>void}){
 const state=useWorkspace();const item=state.submissions.find(value=>value.id===id);
 const [notice,setNotice]=useState("");const [mix,setMix]=useState(false);
 const [fetchedBase,setFetchedBase]=useState<CompositionDto|null>(null);const [baseError,setBaseError]=useState("");
 useEffect(()=>{
  if(!item||item.mine||item.baseComposition)return;
  let active=true;const contributionIds=new Set(item.composition.tracks.map(track=>track.trackId));
  getComposition(item.projectId).then(value=>{if(active)setFetchedBase({...value,tracks:value.tracks.filter(track=>!contributionIds.has(track.trackId))});}).catch(()=>{if(active)setBaseError("원곡을 불러오지 못했습니다. 추가 레이어는 따로 들을 수 있습니다.");});
  return()=>{active=false;};
 },[item]);
 if(!item)return <Page title="참여 내역"><Empty>내역을 찾을 수 없습니다.</Empty></Page>;
 const base=item.baseComposition??fetchedBase;
 const canCompare=!item.mine&&Boolean(base?.tracks.length);
 const composition=mix&&canCompare&&base?{...base,tracks:[...base.tracks.filter(track=>!item.composition.tracks.some(added=>added.trackId===track.trackId)),...item.composition.tracks]}:item.composition;
 return <Page title={item.mine?"제출 상세":"참여 요청 검토"}>
  <span className={workspaceStyles.workspaceStatus}>{labels[item.status]}</span><h2>{item.title}</h2><p>{item.author} · {item.description}</p>
  <div className={workspaceStyles.submissionSongLink}>{item.shortId!==null?<button onClick={()=>onOpenSong(item.shortId!)}>곡으로 이동 →</button>:<span>아직 공개되지 않은 곡입니다.</span>}</div>
  {!item.mine&&<section className={workspaceStyles.submissionReviewActions} aria-label="참여 요청 처리">
   {item.status==="PENDING"?<><div className={workspaceStyles.workspaceActions}><button className={workspaceStyles.workspacePrimary} disabled>승인</button><button disabled>반려</button></div>
    <p>현재 참여 요청 검토 기능을 사용할 수 없습니다.</p></>:<p role="status">이미 {item.status==="APPROVED"?"승인":"반려"} 처리된 요청입니다.</p>}
  </section>}
  {canCompare&&<div className={cn(workspaceStyles.workspaceTabs, workspaceStyles.submissionPlaybackModes)} role="radiogroup" aria-label="미리듣기 모드"><button role="radio" aria-checked={!mix} onClick={()=>setMix(false)}>추가 레이어만</button><button role="radio" aria-checked={mix} onClick={()=>setMix(true)}>원곡과 함께</button></div>}
  {baseError&&!item.mine&&<p role="alert">{baseError}</p>}
  <ClipPlayer key={`${id}:${mix&&canCompare}`} composition={composition}/>
  {item.status==="REJECTED"&&<div className={workspaceStyles.workspaceCard}><h2>반려 사유</h2><p>{item.reason||"등록된 사유가 없습니다."}</p><p>내 작업은 삭제되지 않습니다. 보관함에 넣어 다시 사용할 수 있습니다.</p></div>}
  {item.mine&&<div className={workspaceStyles.workspaceActions}><button className={workspaceStyles.workspacePrimary} onClick={()=>onResume(item.projectId,item.shortId)}>곡 편집기로 이동</button><button onClick={()=>{try{preserveSubmission(id);setNotice("오픈소스 보관함에 저장했습니다.");}catch{setNotice("저장 공간을 확인해주세요.");}}}>내 레이어 보관</button></div>}
  {notice&&<p className={workspaceStyles.workspaceNotice} role="status">{notice}</p>}
 </Page>;
}
export function SourceLibraryScreen({ onUse, importing = false, go }: {
    onUse: (resource: Resource, work?: Work) => Promise<void>;
    importing?: boolean;
    go: Navigate;
}) { const {scope:sourceScope,items:savedSources}=useSavedSources(); const { resources, works } = useWorkspace(); const [targetResource, setTargetResource] = useState<Resource | null>(null); const [filter, setFilter] = useState("ALL"), [query, setQuery] = useState(""), [busy, setBusy] = useState<number | null>(null), [notice, setNotice] = useState(""); const items = resources.filter(r => (filter === "ALL" || filter === "OWN" && r.own || filter === "SAVED" && r.saved) && `${r.title} ${r.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); const visibleSources=importing||filter==="OWN"?[]:savedSources.filter(source=>`${source.title} ${source.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); async function use(resource: Resource, work?: Work) { if (!importing && !work) {
    setTargetResource(resource);
    return;
} if (busy !== null)
    return; setBusy(resource.id); setNotice(""); try {
    await onUse(resource, work);
}
catch (e) {
    setNotice(e instanceof Error ? e.message : "가져오지 못했습니다.");
}
finally {
    setBusy(null);
} } if (targetResource)
    return <Page title="사용할 곡 선택" subtitle={`${targetResource.title} 레이어를 추가할 곡을 선택하세요.`}><button className={workspaceStyles.workspaceWide} onClick={() => setTargetResource(null)}>리소스 목록으로 돌아가기</button>{works.length === 0 ? <Empty>작업 중인 곡이 없습니다. 새 곡을 만든 뒤 레이어 추가에서 보관함을 열어주세요.</Empty> : works.map(work => <button key={work.id} className={cn(workspaceStyles.workspaceCard, workspaceStyles.workspaceCardLink)} disabled={busy !== null} onClick={() => void use(targetResource, work)}><h2>{work.title}</h2><p>{work.composition.tracks.length}개 레이어 · {work.shortId === null ? uiLabels.myMusic : "참여한 작업"}</p><small>이 곡에 추가 →</small></button>)}{notice && <p role="status">{notice}</p>}<button className={workspaceStyles.workspaceWide} onClick={() => go("studio")}>새 곡 만들기</button></Page>; return <Page title={importing ? "MIDI 가져오기" : uiLabels.sourceLibrary} subtitle={importing ? "현재 MIDI에 가져올 노트를 선택하세요." : "내가 만든 레이어와 저장한 리소스를 모아보세요."}><label className={workspaceStyles.workspaceSearch}><Asset name="search-input.svg"/><input aria-label="보관함 검색" placeholder="리소스 검색" value={query} onChange={e => setQuery(e.target.value)}/></label><div className={workspaceStyles.workspaceTabs}>{[["ALL", "전체"], ["OWN", uiLabels.ownLayers], ["SAVED", uiLabels.savedLayers]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>{notice && <p role="status" className={workspaceStyles.workspaceNotice}>{notice}</p>}{items.length === 0&&visibleSources.length===0 ? <Empty>리소스가 없습니다. 작업한 레이어를 보관하거나 오픈소스를 저장해보세요.</Empty> : items.map(r => <article className={workspaceStyles.workspaceCard} key={r.id}><span className={workspaceStyles.workspaceStatus}>{r.own ? uiLabels.ownLayers : "MIDI"}</span><h2>{r.title}</h2><p>{r.description}</p><ClipPlayer composition={r.composition} label={`${r.title} 미리듣기`}/><div className={workspaceStyles.workspaceActions}><button aria-pressed={r.saved} onClick={() => { try {
    toggleResource(r.id);
}
catch {
    setNotice("저장하지 못했습니다.");
} }}>{r.saved ? "저장됨" : "저장"}</button><button className={workspaceStyles.workspacePrimary} disabled={busy !== null} onClick={() => void use(r)}>{busy === r.id ? "가져오는 중…" : importing ? "노트 가져오기" : "내 곡에 사용"}</button></div></article>)}{visibleSources.map(source=><SavedSourceCard key={source.id} source={source} scope={sourceScope}/>)}{!importing && <button className={workspaceStyles.workspaceWide} onClick={() => go("opensource")}>오픈소스 둘러보기</button>}</Page>; }
export type { Submission };

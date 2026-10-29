import { useId, useState } from "react";
import { CanvasDialog } from "@/components/app/dialog";
import { Asset } from "@/components/app/shared";
import { useWorkspace, type Resource } from "@/features/workspace/workspace-store";
import { useSavedSources } from "@/features/community/use-saved-sources";
import type { SavedSource } from "@/features/community/saved-sources";
import "./studio-source-dialog.css";
export function StudioSourceDialog({onClose,onResource,onAudio,midiOnly=false}:{midiOnly?:boolean;onClose:()=>void;onResource:(resource:Resource)=>Promise<void>;onAudio:(source:SavedSource)=>Promise<void>}){
 const id=useId();const {resources}=useWorkspace();const {items}=useSavedSources();
 const [query,setQuery]=useState(""),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
 const matches=(title:string)=>title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 const midi=resources.filter(resource=>matches(resource.title));const audio=midiOnly?[]:items.filter(source=>matches(source.title));
 async function use(key:string,action:()=>Promise<void>){if(busy)return;setBusy(key);setError("");try{await action();}catch(cause){setError(cause instanceof Error?cause.message:"오픈소스를 추가하지 못했습니다.");}finally{setBusy(null);}}
 return <CanvasDialog className="studio-source-dialog" titleId={id} onClose={()=>{if(busy===null)onClose();}}><header><h2 id={id}>오픈소스 추가</h2><button aria-label="오픈소스 추가 닫기" disabled={busy!==null} onClick={onClose}><Asset name="search-close.svg"/></button></header><label><Asset name="search-input.svg"/><input autoFocus aria-label="추가할 오픈소스 검색" placeholder="보관함 검색" value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="studio-source-results">
 {midi.map(resource=><div className="studio-source-row" key={`midi:${resource.id}`}><span><strong>{resource.title}</strong><small>MIDI · {resource.description}</small></span><button className="purple-pill" disabled={busy!==null||(midiOnly&&resource.composition.tracks.some(track=>track.clips.some(clip=>clip.clipType!=="MIDI")))} onClick={()=>void use(`midi:${resource.id}`,()=>onResource(resource))}>{busy===`midi:${resource.id}`?"추가 중…":"추가"}</button></div>)}
 {audio.map(source=><div className="studio-source-row" key={`audio:${source.id}`}><span><strong>{source.title}</strong><small>오디오 · {source.author}</small></span><button className="purple-pill" disabled={busy!==null||!source.mediaKey} onClick={()=>void use(`audio:${source.id}`,()=>onAudio(source))}>{busy===`audio:${source.id}`?"추가 중…":source.mediaKey?"추가":"오디오 없음"}</button></div>)}
 {midi.length+audio.length===0&&<p role="status">{query.trim()?"검색 결과가 없습니다.":"보관함에 저장한 오픈소스가 없습니다."}</p>}</div>{error&&<p role="alert">{error}</p>}</CanvasDialog>;
}

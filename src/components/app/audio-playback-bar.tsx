import { Pause } from "lucide-react";
import { Asset } from "./shared";
import "@/features/community/source-audio-player.css";
export function playbackClock(ms:number){const value=Number.isFinite(ms)?Math.max(0,Math.floor(ms/1000)):0;return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`;}
export function AudioPlaybackBar({playing,muted,positionMs,durationMs,onToggle,onSeek,onMute,disabled=false,loading=false,label="오디오"}:{playing:boolean;muted:boolean;positionMs:number;durationMs:number;onToggle:()=>void;onSeek:(ms:number)=>void;onMute:()=>void;disabled?:boolean;loading?:boolean;label?:string}){
 const position=Math.max(0,Math.min(positionMs,durationMs));
 return <div className="os-audio-player os-audio-player--connected" aria-label={`${label} 재생바`}>
   <button type="button" className="os-audio-play-toggle" disabled={disabled||loading} aria-label={`${label} ${playing?"일시정지":"재생"}`} aria-pressed={playing} aria-busy={loading} onClick={onToggle}>{playing?<Pause aria-hidden="true" size={18}/>:<Asset name="play.svg"/>}</button>
   <span>{playbackClock(position)} / {playbackClock(durationMs)}</span>
   <input className="os-audio-seek" type="range" aria-label={`${label} 재생 위치`} aria-valuetext={`${playbackClock(position)} / ${playbackClock(durationMs)}`} min={0} max={durationMs||0} step={100} value={position} disabled={disabled||loading||durationMs===0} onChange={event=>onSeek(Number(event.target.value))} style={{background:`linear-gradient(to right,var(--purple) ${durationMs?position/durationMs*100:0}%,var(--line-strong) 0)`}}/>
   <button type="button" className="os-audio-mute" disabled={disabled} aria-label={muted?`${label} 소리 켜기`:`${label} 음소거`} aria-pressed={muted} onClick={onMute}><Asset name={muted?"sound-muted.svg":"sound.svg"}/></button>
 </div>;
}

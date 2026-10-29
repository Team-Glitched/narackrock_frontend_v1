import { useSyncExternalStore } from "react";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { getCurrentUserId } from "@/lib/api/client";
import { useCurrentUserId } from "@/hooks/use-current-user";
import type { CompositionDto, TrackDto } from "@/lib/api/composition";
export type Work = {
    id: number;
    shortId: number | null;
    title: string;
    updatedAt: string;
    composition: CompositionDto;
};
export type Submission = {
    id: number;
    projectId: number;
    shortId: number | null;
    title: string;
    author: string;
    description: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reason: string;
    mine: boolean;
    updatedAt: string;
    composition: CompositionDto;
    baseComposition?: CompositionDto;
};
export type Resource = {
    id: number;
    title: string;
    description: string;
    saved: boolean;
    own: boolean;
    composition: CompositionDto;
};
type Workspace = {
    works: Work[];
    submissions: Submission[];
    resources: Resource[];
};
const empty: Workspace = { works: [], submissions: [], resources: [] };
const listeners = new Set<() => void>();
const cache = new Map<string, Workspace>();
const key = () => `narackrock.workspace.${isPreviewMode() ? "preview" : "live"}.${getCurrentUserId() ?? "guest"}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function sampleComposition(): CompositionDto {
    const track = (id: number, ownerId: number, name: string, pitches: number[]): TrackDto => ({ trackId: id, ownerId, name, instrument: "piano", volume: 70, isMuted: false, isSolo: false, approvalStatus: ownerId === 1 ? "DRAFT" : "APPROVED", clips: [{ clipId: id, ownerId, clipType: "MIDI", sourceType: "MIDI_INPUT", mediaFileId: null, mediaUrl: null, startTick: 0, durationTick: 3840, startTimeMs: 0, durationMs: 4000, clipOffsetMs: 0, approvalStatus: ownerId === 1 ? "DRAFT" : "APPROVED", midiNotes: pitches.map((pitch, i) => ({ pitch, startTick: i * 480, durationTick: 360, velocity: 80, effectType: null, effectParams: {} })) }] });
    return { viewerPermission: { userId: 1, canEdit: true, canContribute: true, canReviewContribution: true, canExport: true }, project: { projectId: 1, title: "Pretender", albumImageFileId: null, bpm: 120, ppq: 480, maxTick: 57600, maxDurationMs: 60000, status: "DRAFT", isPublic: false, version: { major: 1, minor: 0, display: "1.0" } }, tracks: [track(10, 2, "Piano", [60, 64, 67, 72]), track(11, 2, "Bass", [36, 40, 43, 48]), track(12, 1, "나의 멜로디", [72, 76, 79, 84])] };
}
function seed(): Workspace {
    const composition = sampleComposition(), date = "2026-10-22T09:00:00+09:00";
    const layer = { ...clone(composition), tracks: [clone(composition.tracks[2])] };
    const proposed = clone(layer);
    proposed.tracks[0].trackId = 13;
    proposed.tracks[0].ownerId = 3;
    proposed.tracks[0].name = "제안한 피아노";
    return { works: [], submissions: [{ id: 101, projectId: 1, shortId: 1, title: "Pretender", author: "나", description: "후렴에 멜로디를 더했어요.", status: "REJECTED", reason: "후렴의 리듬을 조금 더 단순하게 해주세요.", mine: true, updatedAt: date, composition: layer,baseComposition:{...clone(composition),tracks:clone(composition.tracks.slice(0,2))} }, { id: 102, projectId: 1, shortId: 1, title: "Pretender", author: "min chong", description: "새 피아노 멜로디를 제안합니다.", status: "PENDING", reason: "", mine: false, updatedAt: date, composition: proposed,baseComposition:{...clone(composition),tracks:clone(composition.tracks.slice(0,2))} }], resources: [{ id: 201, title: "밝은 피아노 멜로디", description: "미리보기용 MIDI 리소스 · 120 BPM", saved: false, own: false, composition: layer }] };
}
function read(): Workspace {
    if (typeof window === "undefined")
        return empty;
    const k = key();
    if (cache.has(k))
        return cache.get(k)!;
    let state: Workspace;
    try {
        const raw = JSON.parse(localStorage.getItem(k) ?? "null");
        state = raw && ["works", "submissions", "resources"].every(field => Array.isArray(raw[field])) ? {works:raw.works,submissions:raw.submissions,resources:raw.resources} : isPreviewMode() ? seed() : clone(empty);
    }
    catch {
        state = isPreviewMode() ? seed() : clone(empty);
    }
    cache.set(k, state);
    return state;
}
function mutate(change: (value: Workspace) => void) { const next = clone(read()); change(next); localStorage.setItem(key(), JSON.stringify(next)); cache.set(key(), next); listeners.forEach(fn => fn()); }
function subscribe(fn: () => void) { listeners.add(fn); const storage = () => { cache.delete(key()); fn(); }; window.addEventListener("storage", storage); return () => { listeners.delete(fn); window.removeEventListener("storage", storage); }; }
export function useWorkspace() { useCurrentUserId(); return useSyncExternalStore(subscribe, read, () => empty); }
export function rememberWork(composition:CompositionDto,shortId:number|null){mutate(s=>{const work={id:composition.project.projectId,shortId,title:composition.project.title,updatedAt:new Date().toISOString(),composition:clone(composition)};s.works=[work,...s.works.filter(w=>w.id!==work.id)];});}
export function rememberSubmission(composition: CompositionDto, shortId: number | null, description: string) { mutate(s => { const own = { ...clone(composition), tracks: composition.tracks.filter(t => t.ownerId === composition.viewerPermission.userId) }; s.submissions.unshift({ id: Date.now(), projectId: composition.project.projectId, shortId, title: composition.project.title, author: "나", description, status: "PENDING", reason: "", mine: true, updatedAt: new Date().toISOString(), composition: clone(own),baseComposition:{...clone(composition),tracks:composition.tracks.filter(t=>t.ownerId!==composition.viewerPermission.userId)} }); }); }
export function decideSubmission(id:number,status:"APPROVED"|"REJECTED",reason:string){if(!isPreviewMode())throw new Error("검토 결과를 저장하려면 서버 연결이 필요합니다.");mutate(s=>{const item=s.submissions.find(x=>x.id===id);if(!item||item.status!=="PENDING")return;item.status=status;item.reason=reason;item.updatedAt=new Date().toISOString();});}
export function preserveSubmission(id: number) { mutate(s => { const item = s.submissions.find(x => x.id === id); if (!item)
    return; if (s.resources.some(r => r.id === id))
    return; s.resources.unshift({ id, title: `${item.title} · 내 레이어`, description: item.description, saved: true, own: true, composition: clone(item.composition) }); }); }
export function toggleResource(id: number) { mutate(s => { const r = s.resources.find(x => x.id === id); if (r)
    r.saved = !r.saved; }); }
export function preserveTrack(composition: CompositionDto, trackId: number) { mutate(s => { const track = composition.tracks.find(t => t.trackId === trackId); if (!track)
    return; s.resources = s.resources.filter(r => r.id !== trackId); s.resources.unshift({ id: trackId, title: track.name, description: `${composition.project.title} · ${composition.project.bpm} BPM`, saved: true, own: true, composition: { ...clone(composition), tracks: [clone(track)] } }); }); }

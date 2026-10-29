import { useSyncExternalStore } from "react";
import { getCurrentUserId } from "@/lib/api/client";
import { useCurrentUserId } from "@/hooks/use-current-user";
import type { CompositionDto } from "@/lib/api/composition";
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
const key = () => `narackrock.workspace.live.${getCurrentUserId() ?? "guest"}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function read(): Workspace {
    if (typeof window === "undefined")
        return empty;
    const k = key();
    if (cache.has(k))
        return cache.get(k)!;
    let state: Workspace;
    try {
        const raw = JSON.parse(localStorage.getItem(k) ?? "null");
        state = raw && ["works", "submissions", "resources"].every(field => Array.isArray(raw[field])) ? {works:raw.works,submissions:raw.submissions,resources:raw.resources} : clone(empty);
    }
    catch {
        state = clone(empty);
    }
    cache.set(k, state);
    return state;
}
function mutate(change: (value: Workspace) => void) { const next = clone(read()); change(next); localStorage.setItem(key(), JSON.stringify(next)); cache.set(key(), next); listeners.forEach(fn => fn()); }
function subscribe(fn: () => void) { listeners.add(fn); const storage = () => { cache.delete(key()); fn(); }; window.addEventListener("storage", storage); return () => { listeners.delete(fn); window.removeEventListener("storage", storage); }; }
export function useWorkspace() { useCurrentUserId(); return useSyncExternalStore(subscribe, read, () => empty); }
export function rememberWork(composition:CompositionDto,shortId:number|null){mutate(s=>{const work={id:composition.project.projectId,shortId,title:composition.project.title,updatedAt:new Date().toISOString(),composition:clone(composition)};s.works=[work,...s.works.filter(w=>w.id!==work.id)];});}
export function rememberSubmission(composition: CompositionDto, shortId: number | null, description: string) { mutate(s => { const own = { ...clone(composition), tracks: composition.tracks.filter(t => t.ownerId === composition.viewerPermission.userId) }; s.submissions.unshift({ id: Date.now(), projectId: composition.project.projectId, shortId, title: composition.project.title, author: "나", description, status: "PENDING", reason: "", mine: true, updatedAt: new Date().toISOString(), composition: clone(own),baseComposition:{...clone(composition),tracks:composition.tracks.filter(t=>t.ownerId!==composition.viewerPermission.userId)} }); }); }
export function preserveSubmission(id: number) { mutate(s => { const item = s.submissions.find(x => x.id === id); if (!item)
    return; if (s.resources.some(r => r.id === id))
    return; s.resources.unshift({ id, title: `${item.title} · 내 레이어`, description: item.description, saved: true, own: true, composition: clone(item.composition) }); }); }
export function toggleResource(id: number) { mutate(s => { const r = s.resources.find(x => x.id === id); if (r)
    r.saved = !r.saved; }); }
export function preserveTrack(composition: CompositionDto, trackId: number) { mutate(s => { const track = composition.tracks.find(t => t.trackId === trackId); if (!track)
    return; s.resources = s.resources.filter(r => r.id !== trackId); s.resources.unshift({ id: trackId, title: track.name, description: `${composition.project.title} · ${composition.project.bpm} BPM`, saved: true, own: true, composition: { ...clone(composition), tracks: [clone(track)] } }); }); }

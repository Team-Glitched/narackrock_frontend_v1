import { useSyncExternalStore } from "react";
import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import type { CompositionDto } from "@/lib/api/composition";
export type Work = {
  id: number;
  shortId: number | null;
  title: string;
  updatedAt: string;
  composition: CompositionDto;
};
export type WorkVisit = Omit<Work, "composition">;
export type WorkspaceScope = { origin: string; userId: number | null };
export type Resource = {
  id: number;
  title: string;
  description: string;
  saved: boolean;
  own: boolean;
  composition: CompositionDto;
};
type Workspace = {
  works: WorkVisit[];
  resources: Resource[];
};
const empty: Workspace = { works: [], resources: [] };
const listeners = new Set<() => void>();
const cache = new Map<string, Workspace>();
const key = () => `narackrock.workspace.v2:${apiOrigin()}:${getCurrentUserId() ?? "guest"}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function readStoredWorkspace(k: string): Workspace | null {
  try {
    const raw = JSON.parse(localStorage.getItem(k) ?? "null");
    const legacy = JSON.parse(
      localStorage.getItem(`narackrock.workspace.live.${getCurrentUserId() ?? "guest"}`) ?? "null",
    );
    return {
      works: Array.isArray(raw?.works)
        ? raw.works.map(({ id, shortId, title, updatedAt }: WorkVisit) => ({
            id,
            shortId,
            title,
            updatedAt,
          }))
        : [],
      resources: Array.isArray(raw?.resources)
        ? raw.resources
        : Array.isArray(legacy?.resources)
          ? legacy.resources
          : [],
    };
  } catch {
    return null;
  }
}
function read(): Workspace {
  if (typeof window === "undefined") return empty;
  const k = key();
  const cached = cache.get(k);
  if (cached) return cached;
  const state = readStoredWorkspace(k) ?? clone(empty);
  cache.set(k, state);
  return state;
}
function mutate(change: (value: Workspace) => void) {
  const next = clone(read());
  change(next);
  localStorage.setItem(key(), JSON.stringify(next));
  cache.set(key(), next);
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  const storage = () => {
    cache.delete(key());
    fn();
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", storage);
  };
}
export function useWorkspace() {
  useCurrentUserId();
  return useSyncExternalStore(subscribe, read, () => empty);
}
export function rememberWork(composition: CompositionDto, shortId: number | null) {
  mutate((s) => {
    const work = {
      id: composition.project.projectId,
      shortId,
      title: composition.project.title,
      updatedAt: new Date().toISOString(),
    };
    s.works = [work, ...s.works.filter((w) => w.id !== work.id)];
  });
}
/** Removes visit pointers only; local MIDI/resources and project drafts are never deleted here. */
export function forgetMissingWorkVisits(visits: readonly WorkVisit[], scope: WorkspaceScope) {
  if (scope.origin !== apiOrigin() || scope.userId !== getCurrentUserId()) return;
  const k = key();
  // Storage events from other tabs may still be queued when the lookup completes.
  const current = readStoredWorkspace(k) ?? read();
  const missing = new Map(visits.map((visit) => [visit.id, visit.updatedAt]));
  // A project revisited while the lookup was in flight belongs to a newer snapshot.
  const works = current.works.filter((visit) => !missing.has(visit.id) || missing.get(visit.id) !== visit.updatedAt);
  if (works.length === current.works.length) return;
  const next = { ...current, works };
  try {
    window.localStorage.setItem(k, JSON.stringify(next));
  } catch {
    // Cleanup is best effort; a storage failure must not hide successfully loaded projects.
  }
  cache.set(k, next);
  listeners.forEach((fn) => fn());
}
export function toggleResource(id: number) {
  mutate((s) => {
    const r = s.resources.find((x) => x.id === id);
    if (r) r.saved = !r.saved;
  });
}
export function preserveTrack(composition: CompositionDto, trackId: number) {
  mutate((s) => {
    const track = composition.tracks.find((t) => t.trackId === trackId);
    if (!track) return;
    s.resources = s.resources.filter((r) => r.id !== trackId);
    s.resources.unshift({
      id: trackId,
      title: track.name,
      description: `${composition.project.title} · ${composition.project.bpm} BPM`,
      saved: true,
      own: true,
      composition: { ...clone(composition), tracks: [clone(track)] },
    });
  });
}

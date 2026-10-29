import { useRef } from "react";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { notesPath, readId, safeReturnPath, studioPath, withQuery } from "@/features/navigation/paths";
import { importMidiResource, importSavedAudio, type CompositionTarget, type EditorTarget } from "./composition-actions";
import type { Resource, Work } from "@/features/workspace/workspace-store";
import type { SavedSource } from "@/features/community/saved-sources";

export function useRouteComposition() {
  const nav = useAppNavigation();
  const projectId = readId(nav.params.projectId);
  const shortId = readId(nav.params.shortId) ?? readId(nav.query.get("shortId"));
  const trackId = readId(nav.params.trackId) ?? readId(nav.query.get("trackId"));
  const clipId = readId(nav.query.get("clipId"));
  const locked = useRef(false);
  const state = { studioFrom: nav.state.studioFrom ?? safeReturnPath(nav.state.from, nav.preview), studioIndex: nav.state.studioIndex, inbox: nav.state.inbox };
  async function importResource(resource: Resource, work?: Work) {
    if (locked.current) throw new Error("다른 레이어를 추가하는 중입니다.");
    const target: CompositionTarget | null = work ? { projectId: work.id, shortId: work.shortId } : projectId ? { projectId, shortId } : null;
    if (!target) throw new Error("곡을 먼저 선택해주세요.");
    const editor: EditorTarget | undefined = !work && trackId ? { trackId, clipId } : undefined;
    locked.current = true;
    try { return { target, editor: await importMidiResource(resource, target, editor) }; }
    finally { locked.current = false; }
  }
  async function importAudio(source: SavedSource) {
    if (locked.current) throw new Error("다른 레이어를 추가하는 중입니다.");
    if (!projectId) throw new Error("곡을 먼저 선택해주세요.");
    locked.current = true;
    try { await importSavedAudio(source, { projectId, shortId }); }
    finally { locked.current = false; }
  }
  return {
    ...nav, projectId, shortId, trackId, clipId, studioState: state, importResource, importAudio,
    studioUrl: projectId ? studioPath(projectId, shortId) : "/studio/new",
    layerUrl: (step: "layers/new" | "upload" | "record" | "import") => withQuery(`/studio/${projectId}/${step}`, { shortId, ...(step === "import" ? { trackId, clipId } : {}) }),
    notesUrl: (editor: EditorTarget) => notesPath(projectId!, editor.trackId, editor.clipId, shortId),
  };
}

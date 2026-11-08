import { useRef } from "react";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import type { StudioLocationState } from "./studio-location-state";
import {
  notesPath,
  readId,
  safeReturnPath,
  studioPath,
  withQuery,
} from "@/features/navigation/paths";
import {
  importMidiResource,
  PartialLayerError,
  type CompositionTarget,
  type EditorTarget,
} from "./composition-actions";
import type { Resource, Work } from "@/features/workspace/workspace-store";

export function useRouteComposition() {
  const nav = useUrlNavigation<StudioLocationState>();
  const projectId = readId(nav.params.projectId);
  const shortId = readId(nav.params.shortId) ?? readId(nav.query.get("shortId"));
  const trackId = readId(nav.params.trackId) ?? readId(nav.query.get("trackId"));
  const clipId = readId(nav.query.get("clipId"));
  const locked = useRef(false);
  const partial = useRef<{ key: string; error: PartialLayerError } | null>(null);
  const state = {
    studioFrom: nav.state.studioFrom ?? safeReturnPath(nav.state.from),
    studioIndex: nav.state.studioIndex,
    inbox: nav.state.inbox,
    contributionId: readId(nav.query.get("contributionId")) ?? readId(String(nav.state.contributionId)) ?? undefined,
  };
  async function importResource(resource: Resource, work?: Work) {
    if (locked.current) throw new Error("다른 레이어를 추가하는 중입니다.");
    const target: CompositionTarget | null = work
      ? { projectId: work.id, shortId: work.shortId }
      : projectId
        ? { projectId, shortId }
        : null;
    if (!target) throw new Error("곡을 먼저 선택해주세요.");
    locked.current = true;
    try {
      if (trackId && !work)
        throw new Error("기존 레이어 가져오기는 피아노롤의 개인 초안에서 실행해주세요.");
      const key = `${target.projectId}:${resource.id}`;
      if (partial.current) {
        if (partial.current.key !== key || !partial.current.error.retry)
          throw new Error("이전 가져오기를 먼저 재시도해주세요.");
        await partial.current.error.retry();
      } else {
        try {
          await importMidiResource(resource, target);
        } catch (cause) {
          if (cause instanceof PartialLayerError) partial.current = { key, error: cause };
          throw cause;
        }
      }
      partial.current = null;
      return { target };
    } finally {
      locked.current = false;
    }
  }
  return {
    ...nav,
    projectId,
    shortId,
    trackId,
    clipId,
    studioState: state,
    importResource,
    studioUrl: projectId ? studioPath(projectId, shortId) : "/studio/new",
    layerUrl: (step: "layers/new" | "upload" | "record" | "import") =>
      withQuery(`/studio/${projectId}/${step}`, {
        shortId,
        ...(step === "import" ? { trackId, clipId } : {}),
      }),
    notesUrl: (editor: EditorTarget) =>
      notesPath(projectId!, editor.trackId, editor.clipId, shortId),
  };
}

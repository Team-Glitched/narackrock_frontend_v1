import { useCallback } from "react";
import { useNavigate } from "react-router";
import { StudioScreen } from "@/features/screens/studio-screens";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { safeReturnPath, studioPath } from "@/features/navigation/paths";
import { useAppSession } from "@/app/session";
export default function StudioPage() {
  const route = useRouteComposition();
  const navigate = useNavigate();
  const { preview } = useAppSession();
  const { projectId, shortId, to } = route;
  const { studioFrom, studioIndex, inbox } = route.studioState;
  const selectProject = useCallback((id: number) => { if (id !== projectId) to(studioPath(id, shortId), { replace: true, state: { studioFrom, studioIndex, inbox } }); }, [projectId, shortId, to, studioFrom, studioIndex, inbox]);
  return <StudioScreen go={route.go} projectId={projectId} shortId={shortId} returnToNotifications={inbox} onExit={() => {
    const currentIndex = window.history.state?.idx;
    if (Number.isInteger(studioIndex) && studioIndex! >= 0 && Number.isInteger(currentIndex) && currentIndex > studioIndex!) navigate(studioIndex! - currentIndex);
    else to(safeReturnPath(studioFrom, preview), { replace: true, state: { from: undefined } });
  }} onReturnToShort={id => to(`/abyss/${id}`, { replace: true })} onProjectSelected={selectProject} onDraftCreated={id => to(`/studio/${id}/layers/new`, { state: route.studioState })} onAddLayer={() => to(route.layerUrl("layers/new"), { state: route.studioState })} onEditTrack={(trackId, clipId) => to(route.notesUrl({ trackId, clipId }), { state: route.studioState })} onImportResource={async resource => { await route.importResource(resource); }} onImportAudio={route.importAudio} />;
}

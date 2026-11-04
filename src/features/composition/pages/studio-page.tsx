import { useCallback } from "react";
import { useNavigate } from "react-router";
import { DesignViewport } from "@/components/ui/design-viewport";
import { PageState } from "@/components/ui/page-state";
import { StudioScreen } from "@/features/composition/studio-screen";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId, safeReturnPath, studioPath } from "@/features/navigation/paths";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export default function StudioPage() {
  const route = useRouteComposition();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const { projectId, shortId, to, params } = route;
  const { studioFrom, studioIndex, inbox } = route.studioState;
  const selectProject = useCallback(
    (id: number) => {
      if (id !== projectId)
        to(studioPath(id, shortId), {
          replace: true,
          state: { studioFrom, studioIndex, inbox },
        });
    },
    [projectId, shortId, to, studioFrom, studioIndex, inbox],
  );
  const invalidAddress =
    (params.projectId !== undefined && readId(params.projectId) === null) ||
    (params.shortId !== undefined && readId(params.shortId) === null) ||
    (projectId === null && shortId === null);
  return (
    <DesignViewport landscape>
      {invalidAddress ? (
        <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
      ) : (
        <StudioScreen
          key={`${userId ?? "guest"}:${projectId}:${shortId}`}
          projectId={projectId}
          shortId={shortId}
          onSubmitted={() => to("/submissions")}
          onExit={() => {
            const currentIndex = window.history.state?.idx;
            if (
              Number.isInteger(studioIndex) &&
              studioIndex! >= 0 &&
              Number.isInteger(currentIndex) &&
              currentIndex > studioIndex!
            )
              navigate(studioIndex! - currentIndex);
            else to(safeReturnPath(studioFrom), { replace: true, state: { from: undefined } });
          }}
          onReturnToShort={(id) => to(`/abyss/${id}`, { replace: true })}
          onProjectSelected={selectProject}
          onAddLayer={() => to(route.layerUrl("layers/new"), { state: route.studioState })}
          onEditTrack={(trackId, clipId) =>
            to(route.notesUrl({ trackId, clipId }), { state: route.studioState })
          }
          onImportResource={async (resource) => {
            await route.importResource(resource);
          }}
        />
      )}
    </DesignViewport>
  );
}

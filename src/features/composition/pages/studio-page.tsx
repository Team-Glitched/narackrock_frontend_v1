import { useCanvasOrientation } from "@/hooks/use-canvas-orientation";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import {
  NativeStudioBridge,
  NativeStudioInvalidBridge,
} from "@/features/composition/native-studio-bridge";
import { StudioScreen, useStudio, type StudioOptions } from "@/features/composition/studio-screen";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId, safeReturnPath, studioPath } from "@/features/navigation/paths";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { nativeApp } from "@/lib/native-app";

/** One studio state per account/project; browsers draw the web studio, the app the native one. */
function StudioRoute({
  portrait,
  onToggleOrientation,
  ...options
}: StudioOptions & { portrait: boolean; onToggleOrientation: () => void }) {
  const studio = useStudio(options);
  return nativeApp() ? (
    <NativeStudioBridge studio={studio} />
  ) : (
    <StudioScreen
      studio={studio}
      portrait={portrait}
      onToggleOrientation={onToggleOrientation}
    />
  );
}

export default function StudioPage() {
  const route = useRouteComposition();
  const { portrait, toggle } = useCanvasOrientation();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const { projectId, shortId, to, params, viewScope } = route;
  const { studioFrom, studioIndex, inbox, contributionId } = route.studioState;
  const selectProject = useCallback(
    (id: number) => {
      if (id !== projectId)
        to(studioPath(id, shortId, viewScope), {
          replace: true,
          state: { studioFrom, studioIndex, inbox, contributionId },
        });
    },
    [projectId, shortId, to, studioFrom, studioIndex, inbox, contributionId, viewScope],
  );
  const invalidAddress =
    (params.projectId !== undefined && readId(params.projectId) === null) ||
    (params.shortId !== undefined && readId(params.shortId) === null) ||
    (projectId === null && shortId === null);
  const exit = () => {
    const currentIndex = window.history.state?.idx;
    if (
      Number.isInteger(studioIndex) &&
      studioIndex! >= 0 &&
      Number.isInteger(currentIndex) &&
      currentIndex > studioIndex!
    )
      navigate(studioIndex! - currentIndex);
    else to(safeReturnPath(studioFrom), { replace: true, state: { from: undefined } });
  };
  return (
    <DesignViewport landscape={!portrait}>
      {invalidAddress ? (
        nativeApp() ? (
          <NativeStudioInvalidBridge onExit={exit} />
        ) : (
          <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
        )
      ) : (
        <StudioRoute
          portrait={portrait}
          onToggleOrientation={toggle}
          key={`${userId ?? "guest"}:${projectId}:${shortId}:${JSON.stringify(route.view)}`}
          projectId={projectId}
          shortId={shortId}
          contributionId={contributionId}
          view={route.view}
          selectMidiLayer={route.state.selectMidiLayer === true}
          onSubmitted={() => to("/submissions")}
          onExit={exit}
          onReturnToShort={(id) => to(`/abyss/${id}`, { replace: true })}
          onProjectSelected={selectProject}
          onAddLayer={() => to(route.layerUrl("layers/new"), { state: route.studioState })}
          onEditTrack={(trackId, clipId, view) =>
            to(route.notesUrl({ trackId, clipId }, view), {
              replace: route.state.selectMidiLayer === true,
              state: route.studioState,
            })
          }
          onImportResource={async (resource) => {
            await route.importResource(resource);
          }}
        />
      )}
    </DesignViewport>
  );
}

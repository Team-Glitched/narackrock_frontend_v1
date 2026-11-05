import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import { NoteEditorScreen } from "@/features/composition/note-editor-screen";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId } from "@/features/navigation/paths";

export default function NoteEditorPage() {
  const route = useRouteComposition();
  return (
    <DesignViewport landscape>
      {route.projectId === null || readId(route.params.trackId) === null ? (
        <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
      ) : (
        <NoteEditorScreen
          key={`${route.projectId}:${route.trackId}:${route.clipId}`}
          projectId={route.projectId}
          trackId={route.trackId}
          clipId={route.clipId}
          onBack={() => route.to(route.studioUrl, { replace: true, state: route.studioState })}
        />
      )}
    </DesignViewport>
  );
}

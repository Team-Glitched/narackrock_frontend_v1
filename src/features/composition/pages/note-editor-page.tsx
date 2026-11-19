import { useDevicePortrait } from "@/hooks/use-device-portrait";
import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import { NoteEditorScreen } from "@/features/composition/note-editor-screen";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId } from "@/features/navigation/paths";
import { nativeApp } from "@/lib/native-app";
import { NativeNoteEditorStateBridge } from "@/features/composition/native-note-editor-bridge";

export default function NoteEditorPage() {
  const route = useRouteComposition();
  const portrait = useDevicePortrait();
  return (
    <DesignViewport landscape={!portrait}>
      {route.projectId === null || readId(route.params.trackId) === null ? (
        nativeApp() ? (
          <NativeNoteEditorStateBridge
            status="error"
            message="올바르지 않은 페이지 주소입니다."
            onBack={() => route.back("/workspace")}
          />
        ) : (
          <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
        )
      ) : (
        <NoteEditorScreen
          key={`${route.projectId}:${route.trackId}:${route.clipId}:${JSON.stringify(route.view)}`}
          projectId={route.projectId}
          trackId={route.trackId}
          clipId={route.clipId}
          view={route.view}
          onBack={() => route.to(route.studioUrl, { replace: true, state: route.studioState })}
          onOpenLayers={() =>
            route.to(route.studioUrl, {
              replace: true,
              state: { ...route.studioState, selectMidiLayer: true },
            })
          }
          portrait={portrait}
        />
      )}
    </DesignViewport>
  );
}

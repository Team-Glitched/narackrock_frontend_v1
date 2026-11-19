import { useState } from "react";
import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import { NoteEditorScreen } from "@/features/composition/note-editor-screen";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId } from "@/features/navigation/paths";
import { nativeApp } from "@/lib/native-app";
import { NativeNoteEditorStateBridge } from "@/features/composition/native-note-editor-bridge";

/**
 * Touch devices open the piano roll upright (390×844) and desktops in the landscape canvas, unless this browser
 * already chose a layout with the toggle.
 */
const layoutKey = "narackrock.note-editor-layout";

function initialPortrait() {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  try {
    const stored = window.localStorage.getItem(layoutKey);
    return stored === null ? touch : stored === "portrait";
  } catch {
    return touch;
  }
}

export default function NoteEditorPage() {
  const route = useRouteComposition();
  const [portrait, setPortrait] = useState(initialPortrait);
  function toggleLayout() {
    const next = !portrait;
    setPortrait(next);
    try {
      window.localStorage.setItem(layoutKey, next ? "portrait" : "landscape");
    } catch {
      // Storage may be unavailable (private mode); the choice still applies to this visit.
    }
  }
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
          onToggleLayout={toggleLayout}
        />
      )}
    </DesignViewport>
  );
}

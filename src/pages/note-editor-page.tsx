import { NoteEditorScreen } from "@/features/screens/studio-screens";
import { useRouteComposition } from "@/features/composition/use-route-composition";
export default function NoteEditorPage() {
  const route = useRouteComposition();
  return <NoteEditorScreen key={`${route.projectId}:${route.trackId}:${route.clipId}`} projectId={route.projectId} trackId={route.trackId} clipId={route.clipId} onBack={() => route.to(route.studioUrl, { replace: true, state: route.studioState })} onAddLayer={() => route.to(route.layerUrl("layers/new"), { state: route.studioState })} onImportResource={async resource => { await route.importResource(resource); }} />;
}

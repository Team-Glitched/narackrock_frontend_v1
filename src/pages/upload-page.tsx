import { CompositionUploadScreen } from "@/features/screens/composition-creation-screens";
import { saveAudioLayer } from "@/features/composition/composition-actions";
import { useRouteComposition } from "@/features/composition/use-route-composition";
export default function UploadPage() {
  const route = useRouteComposition();
  return <CompositionUploadScreen onBack={() => route.back(route.layerUrl("layers/new"))} onSave={async (file, selection) => { await saveAudioLayer(route.projectId!, file, selection); route.to(route.studioUrl, { replace: true, state: route.studioState }); }} />;
}

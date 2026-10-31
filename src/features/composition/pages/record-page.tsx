import { CompositionRecordScreen } from "@/features/composition/creation-screens";
import { recordingToMidi, saveAudioLayer } from "@/features/composition/composition-actions";
import { useRouteComposition } from "@/features/composition/use-route-composition";
export default function RecordPage() {
  const route = useRouteComposition();
  return (
    <CompositionRecordScreen
      onBack={() => route.back(route.layerUrl("layers/new"))}
      onSave={async (file) => {
        await saveAudioLayer(route.projectId!, file);
        route.to(route.studioUrl, { replace: true, state: route.studioState });
      }}
      onTransform={async (file) => {
        const editor = await recordingToMidi(route.projectId!, file);
        route.to(route.notesUrl(editor), { replace: true, state: route.studioState });
      }}
    />
  );
}

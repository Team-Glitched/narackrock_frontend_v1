import { useState } from "react";
import {
  CompositionChoiceScreen,
  type CreationMethod,
} from "@/features/composition/creation-screens";
import { createPianoLayer } from "@/features/composition/composition-actions";
import { useRouteComposition } from "@/features/composition/use-route-composition";
export default function LayerChoicePage() {
  const route = useRouteComposition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(method: CreationMethod) {
    if (busy || !route.projectId) return;
    if (method !== "note") {
      route.to(route.layerUrl(method), { state: route.studioState });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const editor = await createPianoLayer(route.projectId);
      route.to(route.notesUrl(editor), { state: route.studioState });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "레이어를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <CompositionChoiceScreen
      busy={busy}
      error={error}
      onChoose={(method) => {
        void choose(method);
      }}
      onBack={() => route.to(route.studioUrl, { replace: true, state: route.studioState })}
    />
  );
}

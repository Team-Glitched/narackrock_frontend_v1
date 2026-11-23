import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { uiLabels } from "@/lib/ui-labels";
import type { NativeWorkspace } from "@/lib/native-screens";
import { nativeWork } from "./native-work";
import { useVisitedWorks } from "./use-visited-works";

/** In the app the visited works page (WorkspaceScreen) is drawn natively (native/screens/workspace/works.tsx). */
export function NativeWorkspaceBridge({
  onStartSong,
  onResume,
  onSearch,
  onBack,
}: {
  onStartSong: () => void;
  onResume: (id: number, shortId: number | null) => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const { works, error, loading, appending, hasMore, more } = useVisitedWorks();
  const model: NativeWorkspace = {
    error,
    loading,
    items: works.map((work) => ({
      ...nativeWork(work),
      label: work.shortId === null ? uiLabels.myMusic : "참여한 작업",
    })),
    hasMore,
    appending,
  };
  return useNativeScreen("workspace-works", model, {
    header: { left: "back", actions: ["notifications", "chat", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "start-song":
          return onStartSong();
        case "resume":
          return onResume(action.projectId, action.shortId);
        case "more":
          return more();
      }
    },
  });
}

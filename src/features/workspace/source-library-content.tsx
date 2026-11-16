import { SourceLibraryScreen } from "@/features/workspace/workspace-screens";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { studioPath } from "@/features/navigation/paths";
import type { Resource, Work } from "./workspace-store";

/** The library's navigation and import: a local MIDI work becomes a layer of the chosen song, then the studio opens. */
export function useSourceLibraryActions(importing: boolean) {
  const route = useRouteComposition();
  return {
    onStartSong: () =>
      route.to("/studio/new", {
        state: { studioFrom: route.currentPath, studioIndex: window.history.state?.idx },
      }),
    onOpenSources: () => route.to("/sources"),
    onOpenSource: (id: number) => route.to(`/sources/${id}`),
    onUse: async (resource: Resource, work?: Work) => {
      const result = await route.importResource(resource, work);
      const path = studioPath(result.target.projectId, result.target.shortId);
      route.to(path, {
        replace: importing,
        state: {
          ...route.studioState,
          ...(importing
            ? {}
            : {
                studioFrom: route.currentPath,
                studioIndex: window.history.state?.idx,
              }),
        },
      });
    },
  };
}

export function SourceLibraryContent({ importing }: { importing: boolean }) {
  const actions = useSourceLibraryActions(importing);
  return <SourceLibraryScreen importing={importing} {...actions} />;
}

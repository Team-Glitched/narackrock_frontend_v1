import { SourceLibraryScreen } from "@/features/workspace/workspace-screens";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { studioPath } from "@/features/navigation/paths";

export function SourceLibraryContent({ importing }: { importing: boolean }) {
  const route = useRouteComposition();
  return (
    <SourceLibraryScreen
      importing={importing}
      onStartSong={() =>
        route.to("/studio/new", {
          state: { studioFrom: route.currentPath, studioIndex: window.history.state?.idx },
        })
      }
      onOpenSources={() => route.to("/sources")}
      onOpenSource={(id) => route.to(`/sources/${id}`)}
      onUse={async (resource, work) => {
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
      }}
    />
  );
}

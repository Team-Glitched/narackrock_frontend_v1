import { SourceLibraryScreen } from "@/features/workspace/workspace-screens";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { notesPath, studioPath } from "@/features/navigation/paths";
export default function LibraryPage() {
  const route = useRouteComposition();
  return (
    <SourceLibraryScreen
      go={route.go}
      importing={route.page.id === "import"}
      onUse={async (resource, work) => {
        const result = await route.importResource(resource, work);
        const path = result.editor
          ? notesPath(
              result.target.projectId,
              result.editor.trackId,
              result.editor.clipId,
              result.target.shortId,
            )
          : studioPath(result.target.projectId, result.target.shortId);
        route.to(path, {
          replace: route.page.id === "import",
          state: {
            ...route.studioState,
            studioFrom:
              route.page.id === "import" ? route.studioState.studioFrom : route.currentPath,
          },
        });
      }}
    />
  );
}

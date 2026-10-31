import { WorkspaceScreen } from "@/features/workspace/workspace-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { studioPath } from "@/features/navigation/paths";
export default function WorkspacePage() {
  const { go, to, currentPath } = useAppNavigation();
  return (
    <WorkspaceScreen
      go={go}
      onResume={(id, shortId) =>
        to(studioPath(id, shortId), { state: { studioFrom: currentPath } })
      }
    />
  );
}

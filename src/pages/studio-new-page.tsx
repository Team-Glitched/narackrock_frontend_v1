import { NewProject } from "@/features/screens/studio-screens";
import { safeReturnPath } from "@/features/navigation/paths";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function StudioNewPage() {
  const { to, back, preview, state } = useAppNavigation();
  const studioFrom = state.studioFrom ?? safeReturnPath(state.from, preview);
  return <NewProject onBack={() => back("/")} onCreated={id => to(`/studio/${id}/layers/new`, { state: { studioFrom, studioIndex: state.studioIndex } })} onResume={id => to(`/studio/${id}`, { state: { studioFrom, studioIndex: state.studioIndex } })} />;
}

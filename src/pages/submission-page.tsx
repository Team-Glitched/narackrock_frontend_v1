import { SubmissionDetailScreen } from "@/features/workspace/workspace-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId, studioPath } from "@/features/navigation/paths";
export default function SubmissionPage() {
  const { to, params, currentPath } = useAppNavigation();
  return <SubmissionDetailScreen key={params.submissionId} id={readId(params.submissionId)!} onOpenSong={id => to(`/abyss/${id}`)} onResume={(id, shortId) => to(studioPath(id, shortId), { state: { studioFrom: currentPath } })} />;
}

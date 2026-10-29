import { OpensourceDetailScreen } from "@/features/screens/opensource-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId } from "@/features/navigation/paths";
export default function SourcePage() {
  const { to, params, page } = useAppNavigation();
  return <OpensourceDetailScreen key={params.sourceId} sourceId={readId(params.sourceId)!} focusComments={page.id === "sourceComments"} onProfile={id => to(`/users/${id}`)} />;
}

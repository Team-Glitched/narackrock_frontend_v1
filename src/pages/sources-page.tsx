import { OpensourceScreen } from "@/features/screens/opensource-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function SourcesPage() {
  const { go, to } = useAppNavigation();
  return <OpensourceScreen go={go} onOpen={(id, comments) => to(`/sources/${id}${comments ? "/comments" : ""}`)} />;
}

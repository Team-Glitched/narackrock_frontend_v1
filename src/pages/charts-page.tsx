import { ChartsScreen, type SongChartKind } from "@/features/screens/mobile-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function ChartsPage() {
  const { go, to, query } = useAppNavigation();
  const value = query.get("kind");
  const kind: SongChartKind = value === "mine" || value === "recommended" ? value : "popular";
  return <ChartsScreen go={go} kind={kind} onOpenShort={id => to(`/abyss/${id}`)} />;
}

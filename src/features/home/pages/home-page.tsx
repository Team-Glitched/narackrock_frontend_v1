import { Navigate } from "react-router";
import { HomeScreen } from "@/features/home/home-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId, studioPath } from "@/features/navigation/paths";
export default function HomePage() {
  const { go, to, query, currentPath } = useAppNavigation();
  const sharedShortId = readId(query.get("short"));
  if (sharedShortId) return <Navigate replace to={`/abyss/${sharedShortId}`} />;
  return (
    <HomeScreen
      go={go}
      onOpenPost={(id) => to(`/posts/${id}`)}
      onOpenShort={(id) => to(`/abyss/${id}`)}
      onShowSongs={(kind) => to(`/charts?kind=${kind}`)}
      onResume={(id, shortId) =>
        to(studioPath(id, shortId), { state: { studioFrom: currentPath } })
      }
    />
  );
}

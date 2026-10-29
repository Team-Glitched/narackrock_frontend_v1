import { Navigate } from "react-router";
import { HomeScreen } from "@/features/screens/mobile-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { appPath, readId, studioPath } from "@/features/navigation/paths";
import { useAppSession } from "@/app/session";
export default function HomePage() {
  const { go, to, query, currentPath } = useAppNavigation();
  const { preview } = useAppSession();
  const sharedShortId = readId(query.get("short"));
  if (sharedShortId) return <Navigate replace to={appPath(`/abyss/${sharedShortId}`, preview)} />;
  return <HomeScreen go={go} onOpenPost={id => to(`/posts/${id}`)} onOpenShort={id => to(`/abyss/${id}`)} onShowSongs={kind => to(`/charts?kind=${kind}`)} onResume={(id, shortId) => to(studioPath(id, shortId), { state: { studioFrom: currentPath } })} />;
}

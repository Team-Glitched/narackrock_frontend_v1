import { AbyssScreen } from "@/features/screens/abyss-screen";
import { useAppSession } from "@/app/session";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId } from "@/features/navigation/paths";
export default function AbyssPage() {
  const { go, to, params, currentPath, state } = useAppNavigation();
  const { abyssMuted } = useAppSession();
  const shortId = readId(params.shortId);
  return <AbyssScreen go={go} muted={abyssMuted} initialShortId={shortId} onRememberShort={id => { if (id !== shortId) to(`/abyss/${id}`, { replace: true, state }); }} onJoin={id => to(`/studio/shorts/${id}`, { state: { studioFrom: currentPath } })} />;
}

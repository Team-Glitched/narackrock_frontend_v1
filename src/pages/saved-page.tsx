import { SavedScreen } from "@/features/saved/saved-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function SavedPage() {
  const { to } = useAppNavigation();
  return <SavedScreen onOpenPost={id => to(`/posts/${id}`)} onOpenSong={id => to(`/abyss/${id}`)} />;
}

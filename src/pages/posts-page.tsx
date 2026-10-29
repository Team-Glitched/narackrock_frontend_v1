import { PostsScreen } from "@/features/screens/mobile-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function PostsPage() {
  const { go, to } = useAppNavigation();
  return <PostsScreen go={go} onOpenPost={id => to(`/posts/${id}`)} />;
}

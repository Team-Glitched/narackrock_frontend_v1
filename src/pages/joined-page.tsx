import { JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function JoinedPage() {
  const { to } = useAppNavigation();
  return <JoinedCommunitiesScreen onOpen={community => to(`/communities/${community.galleryId}`)} />;
}

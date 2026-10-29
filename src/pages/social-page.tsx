import { CommunityScreen, type CommunityTab } from "@/features/screens/mobile-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function SocialPage() {
  const { go, to, page } = useAppNavigation();
  const tab: CommunityTab = page.view === "community" ? "community" : page.view === "friends" ? "friends" : "posts";
  return <CommunityScreen go={go} tab={tab} onTabChange={value => to(value === "posts" ? "/social" : value === "community" ? "/communities" : "/friends")} onComments={id => to(`/posts/${id}`)} onOpenCommunity={community => to(`/communities/${community.galleryId}`)} />;
}

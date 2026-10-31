import { ProfileScreen } from "@/features/profile/profile-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId } from "@/features/navigation/paths";
export default function ProfilePage() {
  const { go, to, params } = useAppNavigation();
  const userId = readId(params.userId) ?? undefined;
  return (
    <ProfileScreen
      key={userId ?? "me"}
      userId={userId}
      go={go}
      onOpenShort={(id) => to(`/abyss/${id}`)}
      onOpenPost={(id) => to(`/posts/${id}`)}
    />
  );
}

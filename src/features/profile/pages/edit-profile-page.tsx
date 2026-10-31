import { EditProfileScreen } from "@/features/profile/profile-screens";
import { useAppSession } from "@/app/session";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function EditProfilePage() {
  const { refreshProfile } = useAppSession();
  const { back } = useAppNavigation();
  return (
    <EditProfileScreen
      onSaved={() => {
        refreshProfile();
        back("/profile");
      }}
    />
  );
}

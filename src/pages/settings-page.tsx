import { SettingsScreen } from "@/features/settings/settings-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function SettingsPage() {
  const { go } = useAppNavigation();
  return <SettingsScreen go={go} />;
}

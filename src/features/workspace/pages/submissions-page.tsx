import { SubmissionsScreen } from "@/features/workspace/workspace-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function SubmissionsPage() {
  const { to } = useAppNavigation();
  return <SubmissionsScreen onSelect={(id) => to(`/submissions/${id}`)} />;
}

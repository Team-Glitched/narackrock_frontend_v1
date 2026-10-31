import { ReviewInboxScreen } from "@/features/workspace/workspace-screens";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function ReviewsPage() {
  const { to } = useAppNavigation();
  return <ReviewInboxScreen onSelect={(id) => to(`/submissions/${id}`)} />;
}

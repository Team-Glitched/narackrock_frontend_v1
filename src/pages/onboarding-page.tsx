import { Navigate } from "react-router";
import { InitialProfileSetupScreen } from "@/features/profile/profile-screens";
import { useAppSession } from "@/app/session";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { appPath } from "@/features/navigation/paths";
export default function OnboardingPage() {
  const { to, state } = useAppNavigation();
  const { preview, currentUserId, pendingProfileSetup, setPendingProfileSetup, refreshProfile } = useAppSession();
  const pending = pendingProfileSetup ?? state.pending;
  if (!pending || typeof pending.suggestedNickname !== "string") return <Navigate replace to={appPath(currentUserId ? "/profile/edit" : "/login", preview)} />;
  return <InitialProfileSetupScreen {...pending} onSaved={() => { setPendingProfileSetup(null); refreshProfile(); to("/", { replace: true }); }} />;
}

import { Navigate } from "react-router";
import { InitialProfileSetupScreen } from "@/features/profile/profile-screens";
import { useAuthSession } from "@/features/auth/auth-session";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import type { AuthLocationState } from "../auth-location-state";
import { safeReturnPath } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/ui/design-viewport";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { sharedStyles } from "@/styles/shared.styles";
export default function OnboardingPage() {
  const { to, state } = useUrlNavigation<AuthLocationState>();
  const { currentUserId, pendingProfileSetup, setPendingProfileSetup, refreshProfile } =
    useAuthSession();
  const pending = pendingProfileSetup ?? state.pending;
  if (!pending || typeof pending.suggestedNickname !== "string")
    return <Navigate replace to={currentUserId ? "/profile/edit" : "/login"} />;
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className={sharedStyles.screenBody}>
          <InitialProfileSetupScreen
            {...pending}
            onSaved={() => {
              setPendingProfileSetup(null);
              refreshProfile();
              to(safeReturnPath(state.returnTo), { replace: true, state: { from: state.from } });
            }}
          />
        </div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

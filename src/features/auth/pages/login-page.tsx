import { useCallback } from "react";
import { AuthScreen } from "@/features/auth/auth-screen";
import type { PendingProfileSetup } from "@/features/auth/profile-setup";
import { useAuthSession } from "@/features/auth/auth-session";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import type { AuthLocationState } from "../auth-location-state";
import { DesignViewport } from "@/components/design-viewport";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { sharedStyles } from "@/styles/shared.styles";
import { safeReturnPath } from "@/features/navigation/paths";
export default function LoginPage() {
  const { to, state } = useUrlNavigation<AuthLocationState>();
  const { refreshProfile, setPendingProfileSetup } = useAuthSession();
  const onAuthenticated = useCallback(() => {
    setPendingProfileSetup(null);
    refreshProfile();
    to(safeReturnPath(state.returnTo), { replace: true, state: { from: state.from } });
  }, [refreshProfile, setPendingProfileSetup, state.returnTo, state.from, to]);
  const onFirstLogin = useCallback(
    (pending: PendingProfileSetup) => {
      setPendingProfileSetup(pending);
      to("/onboarding", { state: { pending, returnTo: state.returnTo, from: state.from } });
    },
    [setPendingProfileSetup, to, state.returnTo, state.from],
  );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className={sharedStyles.screenBody}><AuthScreen onAuthenticated={onAuthenticated} onFirstLogin={onFirstLogin} /></div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

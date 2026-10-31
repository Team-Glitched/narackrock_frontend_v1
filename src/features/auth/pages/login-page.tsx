import { useCallback } from "react";
import { AuthScreen, type PendingProfileSetup } from "@/features/auth/auth-screen";
import { useAppSession } from "@/app/session";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { safeReturnPath } from "@/features/navigation/paths";
export default function LoginPage() {
  const { to, state } = useAppNavigation();
  const { refreshProfile, setPendingProfileSetup } = useAppSession();
  const onAuthenticated = useCallback(() => {
    setPendingProfileSetup(null);
    refreshProfile();
    to(safeReturnPath(state.returnTo), { replace: true, state: { from: state.from } });
  }, [refreshProfile, setPendingProfileSetup, state.returnTo, state.from, to]);
  const onFirstLogin = useCallback(
    (pending: PendingProfileSetup) => {
      setPendingProfileSetup(pending);
      to("/onboarding", { state: { pending } });
    },
    [setPendingProfileSetup, to],
  );
  return <AuthScreen onAuthenticated={onAuthenticated} onFirstLogin={onFirstLogin} />;
}

import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeLogin, NativeOnboarding } from "@/lib/native-screens";
import { useGoogleLogin } from "./auth-screen";
import { useInitialProfileSetup } from "./initial-profile-setup";
import type { PendingProfileSetup } from "./profile-setup";

/** In the app the login page (AuthScreen) is drawn natively (native/screens/auth/login.tsx). */
export function NativeLoginBridge({
  onAuthenticated,
  onFirstLogin,
  onHome,
  onPrivacy,
}: {
  onAuthenticated: () => void;
  onFirstLogin: (pending: PendingProfileSetup) => void;
  onHome: () => void;
  onPrivacy: () => void;
}) {
  const login = useGoogleLogin({ onAuthenticated, onFirstLogin });
  const model: NativeLogin = {
    returning: login.returning,
    configured: login.clientId !== "",
    busy: login.busy,
    error: login.error,
  };
  return useNativeScreen("auth-login", model, {
    header: null,
    onAction: (action) => {
      switch (action.type) {
        case "google":
          return login.startNativeLogin();
        case "home":
          return onHome();
        case "privacy":
          return onPrivacy();
      }
    },
  });
}

/** In the app the first-login profile setup (InitialProfileSetupScreen) is drawn natively. */
export function NativeOnboardingBridge({
  suggestedNickname,
  onSaved,
}: {
  suggestedNickname: string;
  onSaved: () => void;
}) {
  const setup = useInitialProfileSetup(suggestedNickname, onSaved);
  const model: NativeOnboarding = {
    step: setup.step,
    values: setup.values,
    saving: setup.saving,
    error: setup.error,
  };
  return useNativeScreen("auth-onboarding", model, {
    header: null,
    onAction: (action) => {
      if (action.type === "advance") void setup.advance(action.value);
    },
  });
}

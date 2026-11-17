import { useAbyssPlaybackPreferences } from "@/features/abyss/playback-preferences";
import { useOperatorAdmin } from "@/features/admin/use-operator-admin";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeSettings } from "@/lib/native-screens";
import { privacyPolicy } from "./privacy-policy";
import { settingsGroupsFor } from "./settings-screen";

/** In the app /settings is drawn natively (native/screens/profile/settings.tsx). */
export function NativeSettingsBridge({
  onNavigate,
  onLogout,
  onSearch,
  onBack,
}: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const { muted, setMuted } = useAbyssPlaybackPreferences();
  const operator = useOperatorAdmin();
  const model: NativeSettings = {
    muted,
    groups: settingsGroupsFor(operator).map((group) => ({
      title: group.title,
      items: group.items.map((item) => ({ ...item })),
    })),
  };
  return useNativeScreen("profile-settings", model, {
    header: { left: "back", actions: ["notifications", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "mute":
          return setMuted(action.value);
        case "open":
          return onNavigate(action.path);
        case "logout":
          return onLogout();
        case "migration":
          return onNavigate("/settings?migration=1");
      }
    },
  });
}

/** In the app /privacy is drawn natively (native/screens/profile/privacy.tsx). */
export function NativePrivacyBridge({
  onHome,
  onSearch,
  onBack,
}: {
  onHome: () => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  return useNativeScreen("profile-privacy", privacyPolicy, {
    header: { left: "back", actions: ["notifications", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type === "home") onHome();
    },
  });
}

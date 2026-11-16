import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { nativeApp } from "@/lib/native-app";
import { sharedStyles } from "@/styles/shared.styles";
import { NativePrivacyBridge } from "../native-settings-bridge";
import { PrivacyPolicyScreen } from "../privacy-policy-screen";

export default function PrivacyPage() {
  const { to, back } = useUrlNavigation();
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/settings")} onSearch={() => to("/search")} />
        <div className={sharedStyles.screenBody}>
          <PrivacyPolicyScreen />
          {nativeApp() && (
            <NativePrivacyBridge onHome={() => to("/")} onSearch={() => to("/search")} onBack={() => back("/settings")} />
          )}
        </div>
      </div>
    </DesignViewport>
  );
}

import { useMemo, type ReactNode } from "react";
import { LoginPromptProvider } from "@/features/auth/login-prompt";
import { AuthSessionProvider } from "@/features/auth/auth-session";
import { AbyssPlaybackProvider } from "@/features/abyss/playback-preferences";
import {
  CommunityMembershipProvider,
  createServerMembershipApi,
} from "@/features/community/community-membership";

export function AppProviders({ children }: { children: ReactNode }) {
  const membershipApi = useMemo(() => createServerMembershipApi(), []);
  return (
    <AuthSessionProvider>
      <LoginPromptProvider>
        <AbyssPlaybackProvider>
          <CommunityMembershipProvider api={membershipApi}>{children}</CommunityMembershipProvider>
        </AbyssPlaybackProvider>
      </LoginPromptProvider>
    </AuthSessionProvider>
  );
}

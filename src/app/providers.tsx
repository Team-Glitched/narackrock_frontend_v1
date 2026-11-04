import { useMemo, type ReactNode } from "react";
import { AuthSessionProvider } from "@/features/auth/auth-session";
import { AbyssPlaybackProvider } from "@/features/abyss/playback-preferences";
import { CommunityMembershipProvider, createServerMembershipApi } from "@/features/community/community-membership";

export function AppProviders({ children }: { children: ReactNode }) {
  const membershipApi = useMemo(() => createServerMembershipApi(), []);
  return (
    <AuthSessionProvider>
      <AbyssPlaybackProvider>
        <CommunityMembershipProvider api={membershipApi}>
          {children}
        </CommunityMembershipProvider>
      </AbyssPlaybackProvider>
    </AuthSessionProvider>
  );
}

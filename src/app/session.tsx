import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router";
import { CommunityMembershipProvider, createServerMembershipApi } from "@/features/screens/community-membership";
import type { PendingProfileSetup } from "@/features/screens/auth-screens";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getProfile } from "@/lib/api/profile";

function useSessionState() {
  const currentUserId = useCurrentUserId();
  const [headerProfile, setHeaderProfile] = useState<{ userId: number; imageUrl: string | null } | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [pendingProfileSetup, setPendingProfileSetup] = useState<PendingProfileSetup | null>(null);
  const [abyssMuted, setAbyssMuted] = useState(false);
  const refreshProfile = useCallback(() => setProfileRevision(value => value + 1), []);
  useEffect(() => {
    if (currentUserId === null) return;
    let cancelled = false;
    getProfile(currentUserId).then(profile => {
      if (!cancelled) setHeaderProfile({ userId: currentUserId, imageUrl: profile.profileImageUrl });
    }).catch(() => { if (!cancelled) setHeaderProfile({ userId: currentUserId, imageUrl: null }); });
    return () => { cancelled = true; };
  }, [currentUserId, profileRevision]);
  const headerProfileImageUrl = currentUserId !== null && headerProfile?.userId === currentUserId ? headerProfile.imageUrl : null;
  return { currentUserId, headerProfileImageUrl, refreshProfile, pendingProfileSetup, setPendingProfileSetup, abyssMuted, setAbyssMuted };
}

const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function useAppSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("AppProviders가 필요합니다.");
  return value;
}

export function AppProviders() {
  const session = useSessionState();
  const membershipApi = useMemo(() => createServerMembershipApi(), []);
  return <SessionContext value={session}><CommunityMembershipProvider api={membershipApi}><Outlet /></CommunityMembershipProvider></SessionContext>;
}

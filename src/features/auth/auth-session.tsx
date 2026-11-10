import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { PendingProfileSetup } from "./profile-setup";
import { rememberSignedIn } from "./returning-user";
import { useCurrentUserId } from "./use-current-user";
import { getProfile } from "@/lib/api/profile";

type AuthSession = {
  currentUserId: number | null;
  headerProfileImageUrl: string | null;
  refreshProfile: () => void;
  pendingProfileSetup: PendingProfileSetup | null;
  setPendingProfileSetup: Dispatch<SetStateAction<PendingProfileSetup | null>>;
};

function useSessionState() {
  const currentUserId = useCurrentUserId();
  const [headerProfile, setHeaderProfile] = useState<{
    userId: number;
    imageUrl: string | null;
  } | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [pendingProfileSetup, setPendingProfileSetup] = useState<PendingProfileSetup | null>(null);
  const refreshProfile = useCallback(() => setProfileRevision((value) => value + 1), []);
  useEffect(() => {
    if (currentUserId === null) return;
    rememberSignedIn();
    let cancelled = false;
    getProfile(currentUserId)
      .then((profile) => {
        if (!cancelled)
          setHeaderProfile({ userId: currentUserId, imageUrl: profile.profileImageUrl });
      })
      .catch(() => {
        if (!cancelled) setHeaderProfile({ userId: currentUserId, imageUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, profileRevision]);
  const headerProfileImageUrl =
    currentUserId !== null && headerProfile?.userId === currentUserId
      ? headerProfile.imageUrl
      : null;
  return {
    currentUserId,
    headerProfileImageUrl,
    refreshProfile,
    pendingProfileSetup,
    setPendingProfileSetup,
  };
}

const AuthSessionContext = createContext<AuthSession | null>(null);
export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("AuthSessionProvider가 필요합니다.");
  return value;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState();
  return <AuthSessionContext value={session}>{children}</AuthSessionContext>;
}

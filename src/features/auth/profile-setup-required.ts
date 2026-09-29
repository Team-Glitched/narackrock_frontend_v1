import type { UserProfile } from "@/lib/api/contracts";

type SetupFields = Pick<UserProfile, "primaryInstrument" | "explanation">;

export function profileSetupRequired(firstLogin: boolean, profile: SetupFields | null): boolean {
  if (firstLogin) return true;
  return profile?.primaryInstrument == null && profile?.explanation == null;
}

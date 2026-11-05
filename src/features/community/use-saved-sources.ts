import { useSyncExternalStore } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { savedSourcesSnapshot, subscribeSavedSources, type SavedSource } from "./saved-sources";
const empty: SavedSource[] = [];
export function useSavedSources() {
  const userId = useCurrentUserId();
  const scope = `live.${userId ?? "guest"}`;
  const items = useSyncExternalStore(
    subscribeSavedSources,
    () => savedSourcesSnapshot(scope),
    () => empty,
  );
  return { scope, items };
}

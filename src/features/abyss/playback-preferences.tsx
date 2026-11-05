import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { parsePlaybackMode, playbackModeKey, type PlaybackMode } from "./short-playback-state";

export type { PlaybackMode };

type PlaybackPreferences = {
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
  mode: PlaybackMode;
  setMode: (mode: PlaybackMode) => void;
};
const PlaybackContext = createContext<PlaybackPreferences | null>(null);

function readMode(key: string): PlaybackMode {
  try {
    return parsePlaybackMode(window.localStorage.getItem(key));
  } catch {
    return "repeat";
  }
}

/** Mute is session memory; the end-of-song mode is stored per API origin and account. */
export function AbyssPlaybackProvider({ children }: { children: ReactNode }) {
  const userId = useCurrentUserId();
  const key = playbackModeKey(apiOrigin(), userId);
  const [muted, setMuted] = useState(false);
  const [stored, setStored] = useState(() => ({ key, mode: readMode(key) }));
  if (stored.key !== key) setStored({ key, mode: readMode(key) });
  const mode = stored.key === key ? stored.mode : readMode(key);
  const setMode = useCallback((next: PlaybackMode) => {
    setStored({ key, mode: next });
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Blocked storage keeps the choice in memory for this session.
    }
  }, [key]);
  const value = useMemo(() => ({ muted, setMuted, mode, setMode }), [muted, mode, setMode]);
  return <PlaybackContext value={value}>{children}</PlaybackContext>;
}
export function useAbyssPlaybackPreferences() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("AbyssPlaybackProvider가 필요합니다.");
  return value;
}

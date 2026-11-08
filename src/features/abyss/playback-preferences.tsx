import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type PlaybackPreferences = {
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
};
const PlaybackContext = createContext<PlaybackPreferences | null>(null);

/** Mute is session memory shared by the abyss header and settings. */
export function AbyssPlaybackProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const value = useMemo(() => ({ muted, setMuted }), [muted]);
  return <PlaybackContext value={value}>{children}</PlaybackContext>;
}
export function useAbyssPlaybackPreferences() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("AbyssPlaybackProvider가 필요합니다.");
  return value;
}

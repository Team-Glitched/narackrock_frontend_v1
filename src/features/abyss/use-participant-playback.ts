"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantAudioPlayer, emptyParticipantPlayback } from "./participant-audio-player";

export function useParticipantPlayback(shortId: number | undefined, muted: boolean, repeat: boolean, onEnded: () => void) {
  const [state, setState] = useState(emptyParticipantPlayback);
  const player = useRef<ParticipantAudioPlayer | null>(null);
  const ended = useRef(onEnded);
  useEffect(() => { ended.current = onEnded; }, [onEnded]);

  useEffect(() => {
    const instance = new ParticipantAudioPlayer(setState, () => ended.current());
    player.current = instance;
    return () => { instance.dispose(); player.current = null; };
  }, [shortId]);
  useEffect(() => { player.current?.setMuted(muted); }, [muted, shortId]);
  useEffect(() => { player.current?.setRepeat(repeat); }, [repeat, shortId]);

  const getPlayer = useCallback(() => player.current, []);
  return { ...state, getPlayer };
}

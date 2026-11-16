import { useEffect, useState, useSyncExternalStore } from "react";

import { engineTransport, subscribeEngine, type Transport } from "./engine.ts";
import { recordingLevels, subscribeRecordingLevels } from "./record.ts";

/**
 * Live transport of the audio engine `engine` (a model's `engine` id): updated every frame while
 * playing, for playheads. Idle (not playing, 0) for null or unknown engines.
 */
export function useNativeAudioState(engine: string | null): Transport {
  const [state, setState] = useState(() => engineTransport(engine));
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      const next = engineTransport(engine);
      setState((previous) =>
        previous.playing === next.playing && previous.positionMs === next.positionMs
          ? previous
          : next,
      );
      if (next.playing) frame = requestAnimationFrame(update);
    };
    update();
    const unsubscribe = engine ? subscribeEngine(engine, update) : () => {};
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [engine]);
  return state;
}

/** Recent normalized microphone peaks (0–1, newest last) while recording; empty otherwise. */
export function useRecordingLevels(): number[] {
  return useSyncExternalStore(subscribeRecordingLevels, recordingLevels);
}

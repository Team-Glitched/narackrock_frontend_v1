import { useEffect, useState } from "react";
import {
  beatIntervalMs,
  beatsPerBarFromSignature,
  isAccentBeat,
} from "./metronome-timing.ts";

export { beatIntervalMs, beatsPerBarFromSignature, isAccentBeat };

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

function scheduleWebClick(
  context: AudioContext,
  when: number,
  accent: boolean,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(accent ? 1200 : 880, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.28 : 0.18, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(when);
  osc.stop(when + 0.05);
}

/** Reuses one AudioContext to play one-shot count-in metronome clicks before recording begins. */
export function createMetronomeClickPlayer(): {
  click: (accent?: boolean) => void;
  close: () => void;
} {
  const AudioCtor =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
      : undefined;
  let context: AudioContext | null = null;
  if (AudioCtor) {
    try {
      context = new AudioCtor();
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      context = null;
    }
  }
  return {
    click(accent = false) {
      if (!context) return;
      if (context.state === "suspended") void context.resume().catch(() => {});
      try {
        scheduleWebClick(context, context.currentTime + 0.005, accent);
      } catch {
        /* Ignore closed/suspended AudioContext errors on teardown. */
      }
    },
    close() {
      const target = context;
      context = null;
      if (target) void target.close().catch(() => {});
    },
  };
}

/**
 * Plays a Web Audio lookahead metronome click while `enabled` is true and exposes the current beat index
 * (`activeBeat`, 0-based within the bar) for synchronized visual pulse feedback.
 */
export function useMetronome({
  enabled,
  bpm,
  timeSignature,
}: {
  enabled: boolean;
  bpm: number;
  timeSignature?: string;
}): { activeBeat: number | null; isAccent: boolean } {
  const [beat, setBeat] = useState<number | null>(null);
  const beatsPerBar = beatsPerBarFromSignature(timeSignature);
  const intervalSeconds = beatIntervalMs(bpm, timeSignature) / 1000;

  useEffect(() => {
    if (!enabled) return;

    const AudioCtor =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined;

    let disposed = false;
    let context: AudioContext | null = null;
    if (AudioCtor) {
      try {
        context = new AudioCtor();
        if (context.state === "suspended") void context.resume().catch(() => {});
      } catch {
        context = null;
      }
    }

    let beatIndex = 0;
    const timeouts = new Set<number>();

    if (context) {
      let nextBeatTime = context.currentTime + 0.02;
      const tick = () => {
        if (disposed || !context) return;
        if (context.state === "suspended") void context.resume().catch(() => {});
        const now = context.currentTime;
        while (nextBeatTime < now + SCHEDULE_AHEAD_SECONDS) {
          const currentBeat = beatIndex;
          const accent = isAccentBeat(currentBeat, beatsPerBar);
          try {
            scheduleWebClick(context, nextBeatTime, accent);
          } catch {
            /* Ignore closed/suspended AudioContext errors on teardown. */
          }
          const delayMs = Math.max(0, (nextBeatTime - now) * 1000);
          const uiTimer = window.setTimeout(() => {
            if (!disposed) setBeat(currentBeat % beatsPerBar);
            timeouts.delete(uiTimer);
          }, delayMs);
          timeouts.add(uiTimer);
          nextBeatTime += intervalSeconds;
          beatIndex += 1;
        }
      };
      tick();
      const scheduler = window.setInterval(tick, LOOKAHEAD_MS);
      return () => {
        disposed = true;
        window.clearInterval(scheduler);
        for (const t of timeouts) window.clearTimeout(t);
        timeouts.clear();
        void context?.close().catch(() => {});
      };
    }

    // Visual-only fallback when Web Audio is unavailable (e.g. restricted headless test env).
    const first = window.setTimeout(() => {
      if (!disposed) setBeat(0);
    }, 0);
    const interval = window.setInterval(() => {
      beatIndex = (beatIndex + 1) % beatsPerBar;
      if (!disposed) setBeat(beatIndex);
    }, intervalSeconds * 1000);
    return () => {
      disposed = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [enabled, beatsPerBar, intervalSeconds]);

  return {
    activeBeat: enabled ? beat : null,
    isAccent: enabled && beat !== null ? isAccentBeat(beat, beatsPerBar) : false,
  };
}

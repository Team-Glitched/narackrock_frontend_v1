"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompositionDto } from "@/lib/api/composition";

const frequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

export function useCompositionPlayback(composition: CompositionDto | null) {
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const positionRef = useRef(0);
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  const stopSources = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    oscillatorsRef.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    oscillatorsRef.current = [];
    audioRef.current.forEach((audio) => { audio.pause(); audio.src = ""; });
    audioRef.current = [];
  }, []);

  const pause = useCallback(() => {
    stopSources();
    setPlaying(false);
  }, [stopSources]);

  const seek = useCallback((nextMs: number) => {
    pause();
    positionRef.current = Math.max(0, nextMs);
    setPositionMs(positionRef.current);
  }, [pause]);

  const play = useCallback(async () => {
    if (!composition) return;
    stopSources();
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();
    const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
    const now = context.currentTime;
    const position = positionRef.current;
    const hasSolo = composition.tracks.some((track) => track.isSolo && !track.isMuted);

    for (const track of composition.tracks) {
      if (track.isMuted || (hasSolo && !track.isSolo)) continue;
      const volume = Math.max(0, Math.min(1, track.volume / 100));
      for (const clip of track.clips) {
        if (clip.clipType === "MIDI") {
          for (const note of clip.midiNotes ?? []) {
            const noteStartMs = (clip.startTick + note.startTick) * tickMs;
            const noteEndMs = noteStartMs + note.durationTick * tickMs;
            if (noteEndMs <= position) continue;
            const start = now + Math.max(0, noteStartMs - position) / 1000;
            const end = now + (noteEndMs - position) / 1000;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "triangle";
            oscillator.frequency.value = frequency(note.pitch);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume * (note.velocity / 127) * 0.18, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, Math.max(start + 0.02, end));
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(start);
            oscillator.stop(end + 0.01);
            oscillatorsRef.current.push(oscillator);
          }
        } else if (clip.mediaUrl) {
          const startMs = clip.startTimeMs;
          const endMs = startMs + clip.durationMs;
          if (endMs <= position) continue;
          const audio = new Audio(clip.mediaUrl);
          audio.volume = volume;
          audio.preload = "auto";
          audioRef.current.push(audio);
          const begin = () => {
            audio.currentTime = (clip.clipOffsetMs + Math.max(0, position - startMs)) / 1000;
            void audio.play().catch(() => {});
          };
          if (startMs <= position) begin();
          else timersRef.current.push(window.setTimeout(begin, startMs - position));
          timersRef.current.push(window.setTimeout(() => audio.pause(), endMs - position));
        }
      }
    }

    setPlaying(true);
    const startedAt = performance.now();
    intervalRef.current = window.setInterval(() => {
      const next = Math.min(composition.project.maxDurationMs, position + performance.now() - startedAt);
      positionRef.current = next;
      setPositionMs(next);
      if (next >= composition.project.maxDurationMs) pause();
    }, 50);
  }, [composition, pause, stopSources]);

  useEffect(() => () => {
    stopSources();
    void contextRef.current?.close();
    contextRef.current = null;
  }, [stopSources]);

  return { playing, positionMs, play, pause, seek };
}

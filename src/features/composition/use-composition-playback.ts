"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { instrumentFor, sampleUrls } from "@/features/composition/instrument-catalog";
import { compositionEndMs, drumTailMs } from "@/features/composition/composition-playback-timeline";
import type { CompositionDto } from "@/lib/api/composition";

export function useCompositionPlayback(composition: CompositionDto | null) {
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolumeState] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const volumeRef = useRef(20);
  const masterGainRef = useRef<Tone.Gain | null>(null);
  const samplersRef = useRef(new Map<string, Tone.Sampler>());
  const loadingRef = useRef(new Map<string, Promise<Tone.Sampler>>());
  const positionRef = useRef(0);
  const playRequestRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  const setVolume = useCallback((next: number) => {
    const value = Math.max(0, Math.min(100, next));
    volumeRef.current = value;
    setVolumeState(value);
    if (masterGainRef.current) masterGainRef.current.gain.value = value / 100;
    audioRef.current.forEach((audio) => { audio.volume = Number(audio.dataset.trackVolume ?? 1) * value / 100; });
  }, []);

  const stopSources = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    samplersRef.current.forEach((sampler) => sampler.releaseAll());
    audioRef.current.forEach((audio) => { audio.pause(); audio.src = ""; });
    audioRef.current = [];
  }, []);

  const pause = useCallback(() => {
    playRequestRef.current++;
    stopSources();
    setPlaying(false);
  }, [stopSources]);

  const seek = useCallback((nextMs: number) => {
    pause();
    positionRef.current = Math.max(0, nextMs);
    setPositionMs(positionRef.current);
  }, [pause]);

  const loadSampler = useCallback((id: string, master: Tone.Gain): Promise<Tone.Sampler> => {
    const cached = loadingRef.current.get(id);
    if (cached) return cached;
    const instrument = instrumentFor(id);
    const promise = new Promise<Tone.Sampler>((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls: sampleUrls(instrument),
        baseUrl: `/audio/instruments/${instrument.id}/`,
        release: 0.08,
        onload: () => resolve(sampler),
        onerror: reject,
      }).connect(master);
      samplersRef.current.set(id, sampler);
    });
    loadingRef.current.set(id, promise);
    void promise.catch(() => {
      samplersRef.current.get(id)?.dispose();
      samplersRef.current.delete(id);
      loadingRef.current.delete(id);
    });
    return promise;
  }, []);

  const audition = useCallback(async (pitch: number, instrumentId: string) => {
    pause();
    const request = playRequestRef.current;
    setError(null);
    try {
      await Tone.start();
      if (request !== playRequestRef.current) return;
      const master = masterGainRef.current ?? new Tone.Gain(volumeRef.current / 100).toDestination();
      masterGainRef.current = master;
      const sampler = await loadSampler(instrumentId, master);
      if (request !== playRequestRef.current) return;
      sampler.triggerAttackRelease(Tone.Frequency(pitch, "midi").toNote(), .35, Tone.now(), .8);
    } catch (cause) {
      if (request === playRequestRef.current) setError(cause instanceof Error ? cause.message : "악기 샘플을 불러오지 못했습니다.");
    }
  }, [loadSampler, pause]);

  const play = useCallback(async () => {
    if (!composition) return;
    const request = ++playRequestRef.current;
    stopSources();
    setError(null);
    const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
    const hasSolo = composition.tracks.some((track) => track.isSolo && !track.isMuted);
    const tracks = composition.tracks.filter((track) => !track.isMuted && (!hasSolo || track.isSolo));
    const endMs = compositionEndMs(composition, tracks);
    if (endMs <= 0) { positionRef.current = 0; setPositionMs(0); setPlaying(false); return; }
    const position = positionRef.current >= endMs ? 0 : positionRef.current;
    positionRef.current = position;
    setPositionMs(position);

    try {
      await Tone.start();
      const master = masterGainRef.current ?? new Tone.Gain(volumeRef.current / 100).toDestination();
      masterGainRef.current = master;
      const ids = [...new Set(tracks.filter((track) => track.clips.some((clip) => clip.clipType === "MIDI"))
        .map((track) => instrumentFor(track.instrument).id))];
      await Promise.all(ids.map((id) => loadSampler(id, master)));
      if (request !== playRequestRef.current) return;

      const transport = Tone.getTransport();
      for (const track of tracks) {
        const instrument = instrumentFor(track.instrument);
        const sampler = samplersRef.current.get(instrument.id);
        const trackVolume = Math.max(0, Math.min(1, track.volume / 100));
        for (const clip of track.clips) {
          if (clip.clipType === "MIDI" && sampler) {
            for (const note of clip.midiNotes ?? []) {
              const noteStartMs = (clip.startTick + note.startTick) * tickMs;
              const noteEndMs = noteStartMs + note.durationTick * tickMs;
              if (noteStartMs + (instrument.kind === "drum" ? drumTailMs : note.durationTick * tickMs) <= position) continue;
              if (instrument.kind === "drum" &&
                  (note.pitch < (instrument.minPitch ?? 35) || note.pitch > (instrument.maxPitch ?? 81))) continue;
              const delay = Math.max(0, noteStartMs - position) / 1000;
              const duration = instrument.kind === "drum" ? 1.45 : Math.max(0.01, (noteEndMs - Math.max(position, noteStartMs)) / 1000);
              const pitch = Tone.Frequency(note.pitch, "midi").toNote();
              const velocity = Math.max(0, Math.min(1, note.velocity / 127 * trackVolume));
              transport.scheduleOnce((time) => sampler.triggerAttackRelease(pitch, duration, time, velocity), delay);
            }
          } else if (clip.clipType === "AUDIO" && clip.mediaUrl) {
            const startMs = clip.startTimeMs;
            const endMs = startMs + clip.durationMs;
            if (endMs <= position) continue;
            const audio = new Audio(clip.mediaUrl);
            audio.dataset.trackVolume = String(trackVolume);
            audio.volume = trackVolume * volumeRef.current / 100;
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

      transport.start();
      setPlaying(true);
      const startedAt = performance.now();
      intervalRef.current = window.setInterval(() => {
        const next = Math.min(endMs, position + performance.now() - startedAt);
        positionRef.current = next;
        setPositionMs(next);
        if (next >= endMs) {
          stopSources();
          positionRef.current = 0;
          setPositionMs(0);
          setPlaying(false);
        }
      }, 50);
    } catch (cause) {
      if (request !== playRequestRef.current) return;
      stopSources();
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : "악기 샘플을 불러오지 못했습니다.");
    }
  }, [composition, loadSampler, stopSources]);

  useEffect(() => () => {
    playRequestRef.current++;
    stopSources();
    samplersRef.current.forEach((sampler) => sampler.dispose());
    samplersRef.current.clear();
    loadingRef.current.clear();
    masterGainRef.current?.dispose();
    masterGainRef.current = null;
  }, [stopSources]);

  return { playing, positionMs, volume, error, setVolume, play, pause, seek, audition };
}

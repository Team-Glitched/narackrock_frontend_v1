"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompositionDto } from "@/lib/api/composition";

const frequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);
const pianoSamplePitches = [21, 24, 36, 48];

export function scheduleMidiEnvelope(gain: AudioParam, start: number, end: number, level: number) {
  const duration = Math.max(0, end - start);
  const attack = Math.min(0.01, duration / 4);
  const release = Math.min(0.08, duration / 4);
  gain.setValueAtTime(0, start);
  gain.linearRampToValueAtTime(level, start + attack);
  gain.setValueAtTime(level, end - release);
  gain.linearRampToValueAtTime(0, end);
}

export function useCompositionPlayback(composition: CompositionDto | null) {
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolumeState] = useState(20);
  const volumeRef = useRef(20);
  const masterGainRef = useRef<GainNode | null>(null);
  const positionRef = useRef(0);
  const contextRef = useRef<AudioContext | null>(null);
  const scheduledSourcesRef = useRef<AudioScheduledSourceNode[]>([]);
  const pianoSamplesRef = useRef<Map<number, AudioBuffer> | null>(null);
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
    scheduledSourcesRef.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    scheduledSourcesRef.current = [];
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

  const play = useCallback(async () => {
    if (!composition) return;
    const request = ++playRequestRef.current;
    stopSources();
    const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
    const hasSolo = composition.tracks.some((track) => track.isSolo && !track.isMuted);
    const endMs = Math.min(composition.project.maxDurationMs, Math.max(0,
      ...composition.tracks.filter((track) => !track.isMuted && (!hasSolo || track.isSolo))
        .flatMap((track) => track.clips.map((clip) => clip.clipType === "MIDI"
          ? Math.max(0, ...(clip.midiNotes ?? []).map((note) =>
              (clip.startTick + note.startTick + note.durationTick) * tickMs))
          : clip.startTimeMs + (clip.durationMs ?? 0))),
    ));
    if (endMs <= 0) { setPlaying(false); return; }
    const position = positionRef.current >= endMs ? 0 : positionRef.current;
    positionRef.current = position;
    setPositionMs(position);
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();
    if (!pianoSamplesRef.current && composition.tracks.some((track) => track.clips.some((clip) => clip.clipType === "MIDI"))) {
      try {
        const samples = await Promise.all(pianoSamplePitches.map(async (pitch) => {
          const name = pitch === 21 ? "A0" : `C${pitch / 12 - 1}`;
          const response = await fetch(`/audio/piano/${name}.mp3`);
          if (!response.ok) throw new Error("피아노 샘플을 불러오지 못했습니다.");
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }));
        pianoSamplesRef.current = new Map(samples);
      } catch { pianoSamplesRef.current = new Map(); }
    }
    if (request !== playRequestRef.current) return;
    const masterGain = masterGainRef.current ?? context.createGain();
    if (!masterGainRef.current) masterGain.connect(context.destination);
    masterGainRef.current = masterGain;
    masterGain.gain.setValueAtTime(volumeRef.current / 100, context.currentTime);
    const now = context.currentTime;

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
            const gain = context.createGain();
            gain.connect(masterGain);
            const nearest = pianoSamplePitches.reduce((best, pitch) => Math.abs(note.pitch - pitch) < Math.abs(note.pitch - best) ? pitch : best);
            const sample = pianoSamplesRef.current?.get(nearest);
            if (sample) {
              scheduleMidiEnvelope(gain.gain, start, end, volume * (note.velocity / 127) * 0.8);
              const source = context.createBufferSource();
              source.buffer = sample;
              source.playbackRate.value = frequency(note.pitch) / frequency(nearest);
              source.loop = end - start > sample.duration / source.playbackRate.value;
              source.connect(gain);
              source.start(start);
              source.stop(end + 0.01);
              scheduledSourcesRef.current.push(source);
              if (end - start >= 1) {
                // The piano recording naturally fades; keep a quiet pitched sustain
                // underneath it until the MIDI note's actual end.
                const sustain = context.createOscillator();
                const sustainGain = context.createGain();
                const sustainLevel = volume * (note.velocity / 127) * 0.06;
                sustain.type = "triangle";
                sustain.frequency.value = frequency(note.pitch);
                sustainGain.gain.setValueAtTime(0, start);
                sustainGain.gain.linearRampToValueAtTime(sustainLevel, start + 0.5);
                sustainGain.gain.setValueAtTime(sustainLevel, end - 0.08);
                sustainGain.gain.linearRampToValueAtTime(0, end);
                sustain.connect(sustainGain).connect(masterGain);
                sustain.start(start);
                sustain.stop(end + 0.01);
                scheduledSourcesRef.current.push(sustain);
              }
            } else {
              scheduleMidiEnvelope(gain.gain, start, end, volume * (note.velocity / 127) * 0.18);
              const oscillator = context.createOscillator();
              oscillator.type = "triangle";
              oscillator.frequency.value = frequency(note.pitch);
              oscillator.connect(gain);
              oscillator.start(start);
              oscillator.stop(end + 0.01);
              scheduledSourcesRef.current.push(oscillator);
            }
          }
        } else if (clip.mediaUrl) {
          const startMs = clip.startTimeMs;
          const endMs = startMs + clip.durationMs;
          if (endMs <= position) continue;
          const audio = new Audio(clip.mediaUrl);
          audio.dataset.trackVolume = String(volume);
          audio.volume = volume * volumeRef.current / 100;
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
      const next = Math.min(endMs, position + performance.now() - startedAt);
      positionRef.current = next;
      setPositionMs(next);
      if (next >= endMs) { stopSources(); setPlaying(false); }
    }, 50);
  }, [composition, stopSources]);

  useEffect(() => () => {
    playRequestRef.current++;
    stopSources();
    void contextRef.current?.close();
    contextRef.current = null;
    masterGainRef.current = null;
  }, [stopSources]);

  return { playing, positionMs, volume, setVolume, play, pause, seek };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { TrackDto } from "@/lib/api/composition";
import type { AudioSelection } from "./prepare-audio-file";
import { signatureTiming, type TimeSignature } from "./time-signature";
import { findInstrument, type InstrumentDefinition } from "./instrument-catalog";
import {
  audioPlaybackWindow,
  buildPlaybackEvents,
  playbackEndMs,
  playbackEventIsDue,
  playbackHasEnded,
  type PlaybackEvent,
} from "./composition-playback-timeline";
import { PlaybackGeneration, PlaybackResources } from "./composition-playback-runtime";
import { partLabel } from "./instrument-parts";
import { onAppBackground } from "@/lib/native-app";

export type PlaybackComposition = {
  project: {
    bpm: number;
    ppq: number;
    maxDurationMs: number;
    timeSignatureNumerator?: number;
    timeSignatureDenominator?: number;
  };
  tracks: TrackDto[];
};

export type CompositionPlaybackOptions = {
  scopeKey?: string;
  durationMs?: number;
  initialVolume?: number;
  muted?: boolean;
  onEnded?: () => void;
};

export type AudioAudition = { file: File; selection?: AudioSelection };

export function projectSignature(composition: PlaybackComposition | null): TimeSignature {
  return {
    numerator: composition?.project.timeSignatureNumerator ?? 4,
    denominator: composition?.project.timeSignatureDenominator ?? 4,
  };
}

const level = (value: number) => Math.max(0, Math.min(100, value));
const message = (cause: unknown) => cause instanceof Error ? cause.message : "오디오를 재생하지 못했습니다.";

/** Instance-local clocks and disposable voice graphs share only decoded resources within this scope. */
export function useCompositionPlayback(
  composition: PlaybackComposition | null,
  options?: CompositionPlaybackOptions,
) {
  const signature = useMemo(() => projectSignature(composition), [composition]);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const metronomeRef = useRef(false);
  const [positionMs, setPositionMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [trackVolumes, setTrackVolumes] = useState<Record<number, number>>({});
  const trackVolumesRef = useRef<Record<number, number>>({});
  const [mutedTrackIds, setMutedTrackIds] = useState<Set<number>>(() => new Set());
  const mutedTrackIdsRef = useRef(new Set<number>());
  const [volume, setVolumeState] = useState(level(options?.initialVolume ?? 20));
  const volumeRef = useRef(volume);
  const optionsRef = useRef(options);
  const compositionRef = useRef(composition);
  const mounted = useRef(false);
  const masterRef = useRef<GainNode | null>(null);
  const resourcesRef = useRef<PlaybackResources | null>(null);
  const mainRef = useRef<PlaybackGeneration | null>(null);
  const previewRef = useRef<PlaybackGeneration | null>(null);
  // Event handlers and clock callbacks read the latest render's inputs; declared first so later layout
  // effects in this hook observe the committed values.
  useLayoutEffect(() => {
    metronomeRef.current = metronome;
    optionsRef.current = options;
    compositionRef.current = composition;
  });
  const mainRequest = useRef(0);
  const previewRequest = useRef(0);
  const positionRef = useRef(0);

  const resources = useCallback(() => resourcesRef.current ??= new PlaybackResources(), []);
  const master = useCallback(() => {
    if (!masterRef.current) {
      const context = Tone.getContext().rawContext;
      masterRef.current = context.createGain();
      masterRef.current.connect(context.destination);
    }
    masterRef.current.gain.value = optionsRef.current?.muted ? 0 : volumeRef.current / 100;
    return masterRef.current;
  }, []);

  const stopPreview = useCallback(() => {
    previewRequest.current++;
    previewRef.current?.stop();
    previewRef.current = null;
  }, []);

  const pause = useCallback(() => {
    mainRequest.current++;
    const generation = mainRef.current;
    if (generation?.epoch) {
      positionRef.current = Math.max(generation.positionMs, Math.min(generation.endMs,
        generation.positionMs + (generation.context.currentTime - generation.epoch) * 1000));
    }
    generation?.stop();
    mainRef.current = null;
    if (mounted.current) {
      setPositionMs(positionRef.current);
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((nextMs: number) => {
    pause();
    const end = compositionRef.current ? playbackEndMs(compositionRef.current, optionsRef.current?.durationMs) : Infinity;
    positionRef.current = Math.max(0, Math.min(end, nextMs));
    setPositionMs(positionRef.current);
  }, [pause]);

  const trackLevel = useCallback((track: TrackDto) => {
    const tracks = compositionRef.current?.tracks ?? [];
    const hasSolo = tracks.some((candidate) => candidate.isSolo && !candidate.isMuted);
    return track.isMuted || mutedTrackIdsRef.current.has(track.trackId) || (hasSolo && !track.isSolo)
      ? 0 : trackVolumesRef.current[track.trackId] ?? track.volume;
  }, []);

  const updateMixer = useCallback((trackId: number) => {
    const track = compositionRef.current?.tracks.find((candidate) => candidate.trackId === trackId);
    if (track) mainRef.current?.track(trackId, trackLevel(track), track.pan);
  }, [trackLevel]);

  const setTrackVolume = useCallback((trackId: number, next: number) => {
    trackVolumesRef.current = { ...trackVolumesRef.current, [trackId]: level(next) };
    setTrackVolumes(trackVolumesRef.current);
    updateMixer(trackId);
  }, [updateMixer]);

  const toggleTrackMute = useCallback((trackId: number) => {
    const next = new Set(mutedTrackIdsRef.current);
    if (next.has(trackId)) next.delete(trackId);
    else next.add(trackId);
    mutedTrackIdsRef.current = next;
    setMutedTrackIds(next);
    updateMixer(trackId);
  }, [updateMixer]);

  const setVolume = useCallback((next: number) => {
    volumeRef.current = level(next);
    setVolumeState(volumeRef.current);
    if (masterRef.current) masterRef.current.gain.value = optionsRef.current?.muted ? 0 : volumeRef.current / 100;
  }, []);

  const schedule = useCallback((generation: PlaybackGeneration, events: PlaybackEvent[], ended: () => void, update?: () => void,
    onTick?: (time: number) => void) => {
    const attacks = events.filter((event) => event.type === "attack");
    const releases = events.filter((event) => event.type === "release");
    let attackIndex = 0;
    let releaseIndex = 0;
    const at = (event: PlaybackEvent) => generation.epoch + (event.atMs - generation.positionMs) / 1000;
    const end = generation.epoch + (generation.endMs - generation.positionMs) / 1000;
    generation.output.gain.setValueAtTime(0, end);
    generation.startClock((time) => {
      const raw = generation.context.currentTime;
      if (playbackHasEnded(generation.epoch, generation.positionMs, generation.endMs, raw)) {
        ended();
        return;
      }
      while (attackIndex < attacks.length && playbackEventIsDue(attacks[attackIndex], generation.epoch, generation.positionMs, time, raw)) {
        const event = attacks[attackIndex++];
        generation.attack(event, Math.max(raw, at(event)));
      }
      // A lookahead release would remove Tone's active sources before pause can release them.
      while (releaseIndex < releases.length && playbackEventIsDue(releases[releaseIndex], generation.epoch, generation.positionMs, time, raw)) {
        generation.release(releases[releaseIndex], raw);
        releaseIndex++;
      }
      onTick?.(time);
    }, update);
  }, []);

  const play = useCallback(async () => {
    const input = compositionRef.current;
    if (!input) return;
    pause();
    stopPreview();
    const request = ++mainRequest.current;
    const live = () => mounted.current && request === mainRequest.current;
    setError(null);
    const endMs = playbackEndMs(input, optionsRef.current?.durationMs);
    if (endMs <= 0) return;
    const position = positionRef.current >= endMs ? 0 : positionRef.current;
    try {
      await Tone.start();
      if (!live()) return;
      const cache = resources();
      const tracks = input.tracks.filter((track) => !track.isMuted &&
        (!input.tracks.some((candidate) => candidate.isSolo && !candidate.isMuted) || track.isSolo));
      const entries = await Promise.all(tracks.map(async (track) => {
        const hasMidi = track.clips.some((clip) => clip.clipType === "MIDI" && clip.midiNotes?.length);
        const instrument = hasMidi ? findInstrument(track.instrument) : undefined;
        if (hasMidi && !instrument) throw new Error(`${track.name}: ${partLabel(track.instrument)} 소리는 재생할 수 없습니다.`);
        const [bank, audio] = await Promise.all([
          instrument ? cache.instruments(instrument) : undefined,
          Promise.all(track.clips.filter((clip) => clip.clipType === "AUDIO").map(async (clip) => {
            if (!clip.mediaUrl) throw new Error(`${track.name}: 오디오 파일 주소가 없습니다.`);
            return { clip, buffer: await cache.buffer(clip.mediaUrl) };
          })),
        ]);
        return { track, bank, audio };
      }));
      if (!live()) return;
      const generation = new PlaybackGeneration(master());
      mainRef.current = generation;
      generation.positionMs = position;
      generation.endMs = endMs;
      generation.epoch = generation.context.currentTime + 0.05;
      for (const { track, bank, audio } of entries) {
        const output = generation.track(track.trackId, trackLevel(track), track.pan);
        if (bank) generation.instrument(track.trackId, bank);
        for (const { clip, buffer } of audio) {
          const window = audioPlaybackWindow(clip, position, buffer.duration);
          if (!window) continue;
          const duration = Math.min(window.durationSeconds, (endMs - position) / 1000 - window.delaySeconds);
          generation.audio(buffer, output, generation.epoch + window.delaySeconds, window.offsetSeconds, duration);
        }
      }
      let beat = Math.ceil(position / signatureTiming(projectSignature(input), input.project.bpm).beatMs);
      const { beatMs } = signatureTiming(projectSignature(input), input.project.bpm);
      let click: AudioBuffer | null = null;
      schedule(generation, buildPlaybackEvents(input, position, endMs), () => {
        if (!live()) return;
        generation.stop();
        mainRef.current = null;
        mainRequest.current++;
        positionRef.current = endMs;
        setPositionMs(endMs);
        setPlaying(false);
        optionsRef.current?.onEnded?.();
      }, () => {
        if (!live()) return;
        positionRef.current = Math.max(position, Math.min(endMs, position + (generation.context.currentTime - generation.epoch) * 1000));
        setPositionMs(positionRef.current);
      }, (time) => {
        const nextBeat = generation.epoch + (beat * beatMs - position) / 1000;
        if (time < nextBeat) return;
        beat++;
        if (!metronomeRef.current || nextBeat >= generation.epoch + (endMs - position) / 1000) return;
        if (!click) {
          click = generation.context.createBuffer(1, Math.ceil(generation.context.sampleRate * 0.04), generation.context.sampleRate);
          const data = click.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 2 * Math.PI * 1000 / click.sampleRate) * 0.15 * (1 - i / data.length);
        }
        generation.audio(click, generation.output, Math.max(generation.context.currentTime, nextBeat), 0, click.duration);
      });
      positionRef.current = position;
      setPositionMs(position);
      setPlaying(true);
    } catch (cause) {
      if (!live()) return;
      mainRef.current?.stop();
      mainRef.current = null;
      setPlaying(false);
      setError(message(cause));
    }
  }, [master, pause, resources, schedule, stopPreview, trackLevel]);

  const previewNotes = useCallback(async (instrument: InstrumentDefinition, pitches: number[], spacing: number, duration: number) => {
    stopPreview();
    const request = ++previewRequest.current;
    const live = () => mounted.current && request === previewRequest.current;
    setError(null);
    try {
      await Tone.start();
      if (!live()) return;
      const bank = await resources().instruments(instrument);
      if (!live()) return;
      const generation = new PlaybackGeneration(master());
      previewRef.current = generation;
      generation.epoch = generation.context.currentTime + 0.03;
      generation.endMs = (pitches.length - 1) * spacing + duration + 80;
      generation.track(0, 100, 0);
      generation.instrument(0, bank);
      const events: PlaybackEvent[] = pitches.flatMap((pitch, index) => {
        const base = { trackId: 0, voiceId: String(index), pitch, velocity: 102 };
        return [{ ...base, type: "attack" as const, atMs: index * spacing },
          { ...base, type: "release" as const, atMs: index * spacing + duration }];
      });
      schedule(generation, events, () => {
        generation.stop();
        if (previewRef.current === generation) previewRef.current = null;
      });
    } catch (cause) {
      if (!live()) return;
      setError(message(cause));
      throw cause;
    }
  }, [master, resources, schedule, stopPreview]);

  const audition = useCallback(async (pitch: number, instrumentId: string | null) => {
    const instrument = findInstrument(instrumentId);
    if (!instrument) {
      stopPreview();
      setError(`${partLabel(instrumentId)} 소리는 재생할 수 없습니다.`);
      return;
    }
    try { await previewNotes(instrument, [pitch], 0, instrument.kind === "drum" ? 1450 : 350); }
    catch { /* The preview reports the sample error without an unhandled event-handler rejection. */ }
  }, [previewNotes, stopPreview]);

  const previewInstrument = useCallback(async (instrumentId: string) => {
    pause();
    const instrument = findInstrument(instrumentId);
    if (!instrument) {
      stopPreview();
      const cause = new Error(`${partLabel(instrumentId)} 소리는 재생할 수 없습니다.`);
      setError(cause.message);
      throw cause;
    }
    const pitches = instrument.kind === "drum" ? [36, 42, 38, 42]
      : instrument.program >= 32 && instrument.program <= 38 ? [36, 40, 43]
      : instrument.program >= 24 && instrument.program <= 30 ? [52, 55, 59] : [60, 64, 67];
    await previewNotes(instrument, pitches, 240, instrument.kind === "drum" ? 1450 : 250);
  }, [pause, previewNotes, stopPreview]);

  const previewAudio = useCallback(async (audition: AudioAudition) => {
    pause();
    stopPreview();
    const request = ++previewRequest.current;
    const live = () => mounted.current && request === previewRequest.current;
    setError(null);
    try {
      await Tone.start();
      if (!live()) return;
      const buffer = await resources().file(audition.file);
      if (!live()) return;
      const start = (audition.selection?.startMs ?? 0) / 1000;
      const end = (audition.selection?.endMs ?? buffer.duration * 1000) / 1000;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= buffer.duration || end <= start || end > buffer.duration + 0.1) {
        throw new Error("선택한 오디오 구간이 올바르지 않습니다.");
      }
      const generation = new PlaybackGeneration(master());
      previewRef.current = generation;
      generation.epoch = generation.context.currentTime + 0.03;
      generation.endMs = (Math.min(end, buffer.duration) - start) * 1000;
      generation.audio(buffer, generation.output, generation.epoch, start, generation.endMs / 1000);
      schedule(generation, [], () => {
        generation.stop();
        if (previewRef.current === generation) previewRef.current = null;
      });
    } catch (cause) {
      if (!live()) return;
      setError(message(cause));
      throw cause;
    }
  }, [master, pause, resources, schedule, stopPreview]);

  useLayoutEffect(() => {
    mounted.current = true;
    volumeRef.current = level(optionsRef.current?.initialVolume ?? 20);
    setVolumeState(volumeRef.current);
    trackVolumesRef.current = {};
    mutedTrackIdsRef.current = new Set();
    setTrackVolumes({});
    setMutedTrackIds(new Set());
    positionRef.current = 0;
    setPositionMs(0);
    setError(null);
    setPlaying(false);
    return () => {
      mounted.current = false;
      pause();
      stopPreview();
      resourcesRef.current?.dispose();
      resourcesRef.current = null;
      masterRef.current?.disconnect();
      masterRef.current = null;
    };
  }, [options?.scopeKey, pause, stopPreview]);

  useLayoutEffect(() => {
    pause();
    stopPreview();
  }, [composition, options?.durationMs, pause, stopPreview]);

  useLayoutEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = options?.muted ? 0 : volumeRef.current / 100;
  }, [options?.muted]);

  // The native app pauses playback when it leaves the foreground (web playback is unaffected).
  useEffect(() => onAppBackground(() => {
    pause();
    stopPreview();
  }), [pause, stopPreview]);

  return {
    signature, metronome, setMetronome, trackVolumes, setTrackVolume, mutedTrackIds, toggleTrackMute,
    playing, positionMs, volume, setVolume, error, play, pause, seek, audition, previewInstrument,
    previewAudio, stopPreview,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import type { CompositionDto } from "@/lib/api/composition";
import { signatureTiming, type TimeSignature } from "./time-signature";
import { findInstrument, sampleUrls, type InstrumentDefinition } from "./instrument-catalog";
import { compositionEndMs, drumTailMs } from "./composition-playback-timeline";
import { partLabel } from "./instrument-parts";

type TrackChain = { gain: Tone.Gain; sampler: Tone.Sampler | null; instrumentId: string | null };

/** The project's shared time signature; the server composition is the only source. */
export function projectSignature(composition: CompositionDto | null): TimeSignature {
  return {
    numerator: composition?.project.timeSignatureNumerator ?? 4,
    denominator: composition?.project.timeSignatureDenominator ?? 4,
  };
}

/**
 * Plays a composition: MIDI notes through each track's sampled instrument (`/audio/instruments/<id>/`), audio
 * clips through media elements. An unknown instrument or a sample that fails to load is reported, never replaced
 * with another sound. Per-track volume/mute are local mixer settings.
 */
export function useCompositionPlayback(composition: CompositionDto | null) {
  const signature = useMemo(() => projectSignature(composition), [composition]);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [trackVolumes, setTrackVolumes] = useState<Record<number, number>>({});
  const trackVolumesRef = useRef<Record<number, number>>({});
  const [mutedTrackIds, setMutedTrackIds] = useState<Set<number>>(() => new Set());
  const mutedTrackIdsRef = useRef(new Set<number>());
  const [volume, setVolumeState] = useState(20);
  const volumeRef = useRef(20);
  const masterRef = useRef<Tone.Gain | null>(null);
  const chainsRef = useRef(new Map<number, TrackChain>());
  const previewRef = useRef(new Map<string, Promise<Tone.Sampler>>());
  const positionRef = useRef(0);
  const playRequestRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement[]>([]);
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  const master = useCallback(() => {
    masterRef.current ??= new Tone.Gain(volumeRef.current / 100).toDestination();
    return masterRef.current;
  }, []);

  const trackLevel = useCallback(
    (trackId: number) =>
      mutedTrackIdsRef.current.has(trackId)
        ? 0
        : (trackVolumesRef.current[trackId] ??
            composition?.tracks.find((track) => track.trackId === trackId)?.volume ??
            100) / 100,
    [composition],
  );

  const applyTrackLevel = useCallback(
    (trackId: number) => {
      const level = trackLevel(trackId);
      const chain = chainsRef.current.get(trackId);
      if (chain) chain.gain.gain.value = level;
      audioRef.current
        .filter((audio) => Number(audio.dataset.trackId) === trackId)
        .forEach((audio) => {
          audio.dataset.trackVolume = String(level);
          audio.volume = (level * volumeRef.current) / 100;
        });
    },
    [trackLevel],
  );

  const setTrackVolume = useCallback(
    (trackId: number, next: number) => {
      trackVolumesRef.current = {
        ...trackVolumesRef.current,
        [trackId]: Math.max(0, Math.min(100, next)),
      };
      setTrackVolumes(trackVolumesRef.current);
      applyTrackLevel(trackId);
    },
    [applyTrackLevel],
  );

  const toggleTrackMute = useCallback(
    (trackId: number) => {
      const next = new Set(mutedTrackIdsRef.current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      mutedTrackIdsRef.current = next;
      setMutedTrackIds(next);
      applyTrackLevel(trackId);
    },
    [applyTrackLevel],
  );

  const setVolume = useCallback((next: number) => {
    const value = Math.max(0, Math.min(100, next));
    volumeRef.current = value;
    setVolumeState(value);
    if (masterRef.current) masterRef.current.gain.value = value / 100;
    audioRef.current.forEach((audio) => {
      audio.volume = (Number(audio.dataset.trackVolume ?? 1) * value) / 100;
    });
  }, []);

  const stopSources = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    chainsRef.current.forEach((chain) => chain.sampler?.releaseAll());
    audioRef.current.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });
    audioRef.current = [];
  }, []);

  const pause = useCallback(() => {
    playRequestRef.current++;
    stopSources();
    setPlaying(false);
  }, [stopSources]);

  const seek = useCallback(
    (nextMs: number) => {
      pause();
      positionRef.current = Math.max(0, nextMs);
      setPositionMs(positionRef.current);
    },
    [pause],
  );

  const loadSampler = useCallback(
    (instrument: InstrumentDefinition, output: Tone.ToneAudioNode) => {
      const { promise, resolve, reject } = Promise.withResolvers<Tone.Sampler>();
      const sampler = new Tone.Sampler({
        urls: sampleUrls(instrument),
        baseUrl: `/audio/instruments/${instrument.id}/`,
        release: 0.08,
        onload: () => resolve(sampler),
        onerror: () => {
          sampler.dispose();
          reject(new Error(`${instrument.label} 샘플을 불러오지 못했습니다.`));
        },
      }).connect(output);
      return promise;
    },
    [],
  );

  /** One sampler per track, so per-track volume and mute apply to MIDI as well as audio. */
  const chainFor = useCallback(
    async (
      track: CompositionDto["tracks"][number],
      instrument: InstrumentDefinition | undefined,
    ) => {
      let chain = chainsRef.current.get(track.trackId);
      if (!chain) {
        chain = {
          gain: new Tone.Gain(trackLevel(track.trackId)).connect(master()),
          sampler: null,
          instrumentId: null,
        };
        chainsRef.current.set(track.trackId, chain);
      }
      if (instrument && (!chain.sampler || chain.instrumentId !== instrument.id)) {
        chain.sampler?.dispose();
        chain.sampler = null;
        const sampler = await loadSampler(instrument, chain.gain);
        chain.instrumentId = instrument.id;
        chain.sampler = sampler;
      }
      return chain;
    },
    [loadSampler, master, trackLevel],
  );

  const play = useCallback(async () => {
    if (!composition) return;
    const request = ++playRequestRef.current;
    stopSources();
    setError(null);
    const tickMs = 60_000 / (composition.project.bpm * composition.project.ppq);
    const hasSolo = composition.tracks.some((track) => track.isSolo && !track.isMuted);
    const tracks = composition.tracks.filter(
      (track) => !track.isMuted && (!hasSolo || track.isSolo),
    );
    const endMs = compositionEndMs(composition, tracks);
    if (endMs <= 0) {
      positionRef.current = 0;
      setPositionMs(0);
      setPlaying(false);
      return;
    }
    const position = positionRef.current >= endMs ? 0 : positionRef.current;
    positionRef.current = position;
    setPositionMs(position);
    const problems: string[] = [];
    try {
      await Tone.start();
      const chains = await Promise.all(
        tracks.map(async (track) => {
          const hasMidi = track.clips.some(
            (clip) => clip.clipType === "MIDI" && clip.midiNotes?.length,
          );
          const instrument = hasMidi ? findInstrument(track.instrument) : undefined;
          if (hasMidi && !instrument) {
            problems.push(
              `${track.name}: ${partLabel(track.instrument)} 소리는 재생할 수 없습니다.`,
            );
            return null;
          }
          try {
            return { track, instrument, chain: await chainFor(track, instrument) };
          } catch (cause) {
            problems.push(
              `${track.name}: ${cause instanceof Error ? cause.message : "샘플을 불러오지 못했습니다."}`,
            );
            return null;
          }
        }),
      );
      if (request !== playRequestRef.current) return;
      const transport = Tone.getTransport();
      for (const entry of chains) {
        if (!entry) continue;
        const { track, instrument, chain } = entry;
        for (const clip of track.clips) {
          if (clip.clipType === "MIDI" && instrument && chain.sampler) {
            const sampler = chain.sampler;
            for (const note of clip.midiNotes ?? []) {
              const noteStartMs = (clip.startTick + note.startTick) * tickMs;
              const noteEndMs = noteStartMs + note.durationTick * tickMs;
              const tail = instrument.kind === "drum" ? drumTailMs : note.durationTick * tickMs;
              if (noteStartMs + tail <= position) continue;
              if (
                instrument.kind === "drum" &&
                (note.pitch < (instrument.minPitch ?? 35) ||
                  note.pitch > (instrument.maxPitch ?? 81))
              )
                continue;
              const delay = Math.max(0, noteStartMs - position) / 1000;
              const duration =
                instrument.kind === "drum"
                  ? 1.45
                  : Math.max(0.01, (noteEndMs - Math.max(position, noteStartMs)) / 1000);
              const pitch = Tone.Frequency(note.pitch, "midi").toNote();
              const velocity = Math.max(0, Math.min(1, note.velocity / 127));
              transport.scheduleOnce(
                (time) => sampler.triggerAttackRelease(pitch, duration, time, velocity),
                delay,
              );
            }
          } else if (clip.clipType === "AUDIO" && clip.mediaUrl) {
            const startMs = clip.startTimeMs;
            const clipEndMs = startMs + clip.durationMs;
            if (clipEndMs <= position) continue;
            const level = trackLevel(track.trackId);
            const audio = new Audio(clip.mediaUrl);
            audio.dataset.trackId = String(track.trackId);
            audio.dataset.trackVolume = String(level);
            audio.volume = (level * volumeRef.current) / 100;
            audio.preload = "auto";
            audioRef.current.push(audio);
            const begin = () => {
              audio.currentTime = (clip.clipOffsetMs + Math.max(0, position - startMs)) / 1000;
              void audio
                .play()
                .catch((cause) =>
                  setError(
                    cause instanceof Error ? cause.message : "오디오를 재생하지 못했습니다.",
                  ),
                );
            };
            if (startMs <= position) begin();
            else timersRef.current.push(window.setTimeout(begin, startMs - position));
            timersRef.current.push(window.setTimeout(() => audio.pause(), clipEndMs - position));
          }
        }
      }
      if (problems.length) setError(problems.join(" "));
      transport.start();
      setPlaying(true);
      const startedAt = performance.now();
      intervalRef.current = window.setInterval(() => {
        const next = Math.min(endMs, position + performance.now() - startedAt);
        positionRef.current = next;
        setPositionMs(next);
        if (next >= endMs) {
          stopSources();
          setPlaying(false);
        }
      }, 50);
    } catch (cause) {
      if (request !== playRequestRef.current) return;
      stopSources();
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : "재생을 시작하지 못했습니다.");
    }
  }, [chainFor, composition, stopSources, trackLevel]);

  const previewSampler = useCallback(
    (instrument: InstrumentDefinition): Promise<Tone.Sampler> => {
      const cached = previewRef.current.get(instrument.id);
      if (cached) return cached;
      const loading = loadSampler(instrument, master());
      previewRef.current.set(instrument.id, loading);
      loading.catch(() => previewRef.current.delete(instrument.id));
      return loading;
    },
    [loadSampler, master],
  );

  /** Plays one note of an instrument (note entry feedback). */
  const audition = useCallback(
    async (pitch: number, instrumentId: string | null) => {
      const instrument = findInstrument(instrumentId);
      if (!instrument) {
        setError(`${partLabel(instrumentId)} 소리는 재생할 수 없습니다.`);
        return;
      }
      try {
        await Tone.start();
        const sampler = await previewSampler(instrument);
        sampler.triggerAttackRelease(Tone.Frequency(pitch, "midi").toNote(), 0.35, Tone.now(), 0.8);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "악기 샘플을 불러오지 못했습니다.");
      }
    },
    [previewSampler],
  );

  /** A short phrase of an instrument for the picker; it never creates or changes a track. */
  const previewInstrument = useCallback(
    async (instrumentId: string) => {
      const instrument = findInstrument(instrumentId);
      if (!instrument)
        throw new Error(`${partLabel(instrumentId)}은(는) 녹음 역할이라 미리듣기 소리가 없습니다.`);
      pause();
      await Tone.start();
      const sampler = await previewSampler(instrument);
      const pitches =
        instrument.kind === "drum"
          ? [36, 42, 38, 42]
          : instrument.program >= 32 && instrument.program <= 38
            ? [36, 40, 43]
            : instrument.program >= 24 && instrument.program <= 30
              ? [52, 55, 59]
              : [60, 64, 67];
      const now = Tone.now();
      pitches.forEach((pitch, index) =>
        sampler.triggerAttackRelease(
          Tone.Frequency(pitch, "midi").toNote(),
          instrument.kind === "drum" ? 1.45 : 0.25,
          now + index * 0.24,
          0.8,
        ),
      );
    },
    [pause, previewSampler],
  );

  useEffect(() => {
    const chains = chainsRef.current;
    const previews = previewRef.current;
    const requestState = playRequestRef;
    return () => {
      requestState.current++;
      stopSources();
      chains.forEach((chain) => {
        chain.sampler?.dispose();
        chain.gain.dispose();
      });
      chains.clear();
      previews.forEach(
        (loading) => void loading.then((sampler) => sampler.dispose()).catch(() => {}),
      );
      previews.clear();
      masterRef.current?.dispose();
      masterRef.current = null;
    };
  }, [stopSources]);

  useEffect(() => {
    if (!playing || !metronome || !composition) return;
    const context = Tone.getContext().rawContext;
    const output = masterRef.current;
    if (!output) return;
    const { beatMs } = signatureTiming(signature, composition.project.bpm);
    let lastBeat = -1;
    const tick = () => {
      const beat = Math.floor(positionRef.current / beatMs);
      if (beat === lastBeat) return;
      lastBeat = beat;
      const click = new Tone.Oscillator(beat % signature.numerator === 0 ? 1200 : 800, "sine");
      const envelope = new Tone.Gain(0.15).connect(output);
      click.connect(envelope);
      click.start();
      envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
      click.stop(`+0.04`);
      window.setTimeout(() => {
        click.dispose();
        envelope.dispose();
      }, 200);
    };
    tick();
    const timer = window.setInterval(tick, 25);
    return () => window.clearInterval(timer);
  }, [playing, metronome, composition, signature]);

  return {
    signature,
    metronome,
    setMetronome,
    trackVolumes,
    setTrackVolume,
    mutedTrackIds,
    toggleTrackMute,
    playing,
    positionMs,
    volume,
    setVolume,
    error,
    play,
    pause,
    seek,
    audition,
    previewInstrument,
  };
}

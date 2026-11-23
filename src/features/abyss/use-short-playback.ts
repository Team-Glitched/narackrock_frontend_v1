import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useCompositionPlayback, type PlaybackComposition } from "@/features/composition/use-composition-playback";
import { ApiError, apiOrigin } from "@/lib/api/client";
import type { ShortItemDto } from "@/lib/api/contracts";
import { toggleShortPlayback, type ShortParticipantTracks } from "@/lib/api/shorts";
import { shortParticipantTracksQuery } from "./abyss-queries";
import {
  listenerDurationMs,
  normalizeOwnerSelection,
  ownerTracks,
  sameOwnerSelection,
  type OwnerSelection,
} from "./short-playback-state";

export type { OwnerSelection };

export type StemsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: ShortParticipantTracks }
  | { status: "error"; error: string };
const IDLE_STEMS: StemsState = { status: "idle" };

type NativeEvent = { currentTarget: HTMLAudioElement };

export type ShortPlayback = {
  /** Applied selection; survives closing and reopening the participant sheet. */
  selection: OwnerSelection;
  /** Sheet-local selection, copied from `selection` when the sheet opens. */
  draft: OwnerSelection;
  setDraft: (next: OwnerSelection) => void;
  openSelection: () => void;
  /** Applies the normalized draft; every close path of the sheet calls this. */
  applyDraft: () => void;
  /** Returns to the original full mix at the current position. */
  listenAll: () => void;
  stems: StemsState;
  retryStems: () => void;
  playing: boolean;
  canPlay: boolean;
  positionMs: number;
  totalMs: number;
  toggle: () => Promise<void>;
  seek: (ms: number) => void;
  restart: () => void;
  error: string | null;
  nativeHandlers: {
    onLoadedMetadata: (event: NativeEvent) => void;
    onTimeUpdate: (event: NativeEvent) => void;
    onPlay: (event: NativeEvent) => void;
    onPause: () => void;
    onEnded: () => void;
  };
};

type Keyed<T> = { key: string; value: T };
type NativeState = { key: string; playing: boolean; timeMs: number; durationMs: number };

function stemsError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 403) return "참여자 트랙을 볼 권한이 없습니다.";
  if (cause instanceof ApiError && cause.status === 401) return "로그인 후 참여자 트랙을 들을 수 있습니다.";
  return "참여자 트랙을 불러오지 못했습니다.";
}

/**
 * UI transport for one short: the native `<audio>` plays the original mix, the shared composition engine plays an
 * owner subset. Only one of them sounds at a time; switching keeps the song position and the play/pause intent.
 */
export function useShortPlayback({
  short,
  audioRef,
  muted,
}: {
  short: ShortItemDto | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  muted: boolean;
}): ShortPlayback {
  const userId = useCurrentUserId();
  const origin = apiOrigin();
  const shortId = short?.shortId ?? null;
  const key = JSON.stringify([origin, userId ?? "guest", shortId]);
  const mediaUrl = short?.mediaUrl?.trim() || null;

  const [selectionState, setSelectionState] = useState<Keyed<OwnerSelection>>({ key, value: null });
  const selection = selectionState.key === key ? selectionState.value : null;
  const [draftState, setDraftState] = useState<Keyed<OwnerSelection>>({ key, value: null });
  const draft = draftState.key === key ? draftState.value : null;
  // Stems load on demand (sheet, subset start or retry), then stay cached per account by the query client.
  const [stemsRequestKey, setStemsRequestKey] = useState<string | null>(null);
  const stemsQuery = useQuery({
    ...shortParticipantTracksQuery(userId, shortId ?? 0),
    enabled: userId !== null && shortId !== null && stemsRequestKey === key,
  });
  const stemsData = stemsQuery.data;
  const stemsFailure = stemsQuery.isError ? stemsQuery.error : null;
  const stems = useMemo<StemsState>(() => {
    if (stemsData) return { status: "ready", data: stemsData };
    if (stemsRequestKey !== key) return IDLE_STEMS;
    return stemsFailure ? { status: "error", error: stemsError(stemsFailure) } : { status: "loading" };
  }, [key, stemsData, stemsFailure, stemsRequestKey]);
  const emptyNative: NativeState = { key, playing: false, timeMs: 0, durationMs: 0 };
  const [nativeState, setNativeState] = useState<NativeState>(emptyNative);
  const native = nativeState.key === key ? nativeState : emptyNative;
  const [intentState, setIntentState] = useState<Keyed<boolean>>({ key, value: false });
  const intent = intentState.key === key && intentState.value;
  const [messageState, setMessageState] = useState<Keyed<string | null>>({ key, value: null });
  const message = messageState.key === key ? messageState.value : null;

  const keyRef = useRef(key);
  const pendingStart = useRef(false);
  const pendingPatch = useRef(false);
  const handleEndedRef = useRef<() => void>(() => {});

  const composition = useMemo<PlaybackComposition | null>(() => {
    if (!selection?.size || stems.status !== "ready") return null;
    const tracks = ownerTracks(stems.data.tracks, selection);
    return tracks.length ? { project: stems.data.project, tracks } : null;
  }, [selection, stems]);
  const maxDurationMs = stems.status === "ready" ? stems.data.project.maxDurationMs : null;
  const durationMs = maxDurationMs === null ? undefined
    : listenerDurationMs(native.durationMs > 0 ? native.durationMs : null, maxDurationMs);
  const engine = useCompositionPlayback(composition, {
    scopeKey: key,
    muted,
    durationMs,
    onEnded: () => handleEndedRef.current(),
  });
  const { pause: pauseEngine, play: playEngine, seek: seekEngine } = engine;

  // Short, account or origin change: drop pending starts; keyed state above resets itself.
  useLayoutEffect(() => {
    keyRef.current = key;
    pendingStart.current = false;
    pendingPatch.current = false;
  }, [key]);

  const setIntent = useCallback((value: boolean) => setIntentState({ key: keyRef.current, value }), []);

  function ensureStems() {
    if (userId === null || shortId === null) return;
    if (stemsRequestKey !== key) setStemsRequestKey(key);
    else if (stemsQuery.isError) void stemsQuery.refetch();
  }

  // The original autoplays on every new short; a blocked autoplay stays paused until the play button.
  useEffect(() => {
    if (!mediaUrl) return;
    void audioRef.current?.play().catch(() => {});
  }, [audioRef, key, mediaUrl]);

  // A requested subset start waits for its stems and the filtered composition.
  useEffect(() => {
    if (!pendingStart.current || !composition) return;
    pendingStart.current = false;
    void playEngine();
  }, [composition, playEngine]);

  // Partial data errors stop at the current position; the full mix is never substituted.
  const failed = selection !== null && (stems.status === "error" || engine.error !== null);
  useEffect(() => {
    if (!failed) return;
    pendingStart.current = false;
    pendingPatch.current = false;
    setIntent(false);
  }, [failed, setIntent]);

  // The playback toggle is reported only once a user's subset start actually plays.
  const enginePlaying = engine.playing;
  const enginePositionMs = engine.positionMs;
  useEffect(() => {
    if (!enginePlaying || !pendingPatch.current || shortId === null || userId === null) return;
    pendingPatch.current = false;
    void toggleShortPlayback(shortId, true, enginePositionMs / 1000).catch(() => {});
  }, [enginePlaying, enginePositionMs, shortId, userId]);

  function apply(next: OwnerSelection) {
    if (sameOwnerSelection(selection, next)) return;
    const audio = audioRef.current;
    const wasOriginal = selection === null;
    const wantPlay = wasOriginal ? Boolean(audio && !audio.paused) : intent;
    const position = wasOriginal ? (audio?.currentTime ?? 0) * 1000 : engine.positionMs;
    // Stop the previous path first so the original and a subset never sound together.
    if (wasOriginal) audio?.pause();
    else pauseEngine();
    pendingStart.current = false;
    pendingPatch.current = false;
    setMessageState({ key, value: null });
    setSelectionState({ key, value: next });
    if (next === null) {
      setIntent(false);
      if (audio) {
        audio.currentTime = position / 1000;
        if (wantPlay && mediaUrl) {
          void audio.play().catch(() => setMessageState({ key, value: "음원을 재생하지 못했습니다." }));
        }
      }
      return;
    }
    seekEngine(position);
    if (next.size === 0) {
      setIntent(false);
      return;
    }
    if (stems.status === "ready" && ownerTracks(stems.data.tracks, next).length === 0) {
      setIntent(false);
      setMessageState({ key, value: "선택한 참여자에게 재생할 승인 트랙이 없습니다." });
      return;
    }
    setIntent(wantPlay);
    pendingStart.current = wantPlay;
    if (stems.status !== "ready") ensureStems();
  }

  async function toggle() {
    const audio = audioRef.current;
    if (shortId === null) return;
    setMessageState({ key, value: null });
    if (selection === null) {
      if (!audio || !mediaUrl) return;
      const willPlay = audio.paused;
      if (!willPlay) audio.pause();
      else {
        try {
          await audio.play();
        } catch {
          setMessageState({ key, value: "음원을 재생하지 못했습니다." });
          return;
        }
      }
      if (userId !== null) void toggleShortPlayback(shortId, willPlay, audio.currentTime).catch(() => {});
      return;
    }
    if (selection.size === 0) return;
    if (intent) {
      pendingStart.current = false;
      pendingPatch.current = false;
      pauseEngine();
      setIntent(false);
      if (userId !== null) void toggleShortPlayback(shortId, false, engine.positionMs / 1000).catch(() => {});
      return;
    }
    setIntent(true);
    pendingPatch.current = true;
    if (composition) void playEngine();
    else {
      pendingStart.current = true;
      ensureStems();
    }
  }

  function seek(ms: number) {
    if (selection === null) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = ms / 1000;
      setNativeState({ ...native, timeMs: ms });
      return;
    }
    seekEngine(ms);
    if (intent && selection.size > 0) {
      if (composition) void playEngine();
      else pendingStart.current = true;
    }
  }

  // Explicit next-to-self starts playback even if the listener paused the current short.
  function restart() {
    setMessageState({ key, value: null });
    if (selection === null) {
      const audio = audioRef.current;
      if (!audio || !mediaUrl) return;
      audio.currentTime = 0;
      setNativeState({ ...native, timeMs: 0 });
      void audio.play().catch(() => setMessageState({ key, value: "음원을 재생하지 못했습니다." }));
      return;
    }
    seekEngine(0);
    if (selection.size === 0 || failed) return;
    setIntent(true);
    if (composition) void playEngine();
    else {
      pendingStart.current = true;
      ensureStems();
    }
  }

  // The native `ended` and the engine's `onEnded` both land here; a short repeats until the listener moves on.
  function handleEnded() {
    if (selection === null) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
      return;
    }
    // Restart outside the engine clock callback that reported the end.
    window.setTimeout(() => {
      if (keyRef.current !== key) return;
      seekEngine(0);
      void playEngine();
    }, 0);
  }
  useLayoutEffect(() => {
    handleEndedRef.current = handleEnded;
  });

  const updateNative = (patch: Partial<NativeState>) =>
    setNativeState((state) => ({ ...(state.key === key ? state : emptyNative), ...patch }));

  let error: string | null = message;
  if (selection !== null) error = stems.status === "error" ? stems.error : engine.error ?? message;

  return {
    selection,
    draft,
    setDraft: (next) => setDraftState({ key, value: next }),
    openSelection: () => {
      setDraftState({ key, value: selection });
      ensureStems();
    },
    applyDraft: () => apply(stems.status === "ready"
      ? normalizeOwnerSelection(draft, stems.data.tracks.map((track) => track.ownerId))
      : draft),
    listenAll: () => {
      setDraftState({ key, value: null });
      apply(null);
    },
    stems,
    retryStems: ensureStems,
    playing: selection === null ? native.playing : intent && !failed,
    canPlay: selection === null ? Boolean(mediaUrl)
      : selection.size > 0 && !failed && (composition !== null || stems.status !== "ready"),
    positionMs: selection === null ? native.timeMs : engine.positionMs,
    totalMs: selection === null ? native.durationMs : durationMs ?? native.durationMs,
    toggle,
    seek,
    restart,
    error,
    nativeHandlers: {
      onLoadedMetadata: (event) => {
        const duration = event.currentTarget.duration;
        updateNative({ durationMs: Number.isFinite(duration) ? duration * 1000 : 0 });
      },
      onTimeUpdate: (event) => updateNative({ timeMs: event.currentTarget.currentTime * 1000 }),
      onPlay: (event) => {
        // Media keys or a late autoplay must not start the original under an owner subset.
        if (selection !== null) event.currentTarget.pause();
        else updateNative({ playing: true });
      },
      onPause: () => updateNative({ playing: false }),
      onEnded: () => {
        updateNative({ playing: false });
        if (selection === null) handleEnded();
      },
    },
  };
}

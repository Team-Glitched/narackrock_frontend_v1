/**
 * Audio previews of the app's native sample screens. The audio elements stay in the web page; small
 * invisible components report each player's state (`NativePlayback`) and controls by key, and the
 * bridge performs the app's play/seek/mute actions with them. Also maps the saved-sample library
 * (`useSavedOpenSources`) to the native model shared by /library and /sources?tab=saved.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  NativePlayback,
  NativePlaybackTarget,
  NativeSavedSources,
} from "@/lib/native-screens";
import type { SavedOpenSourcesState } from "./saved-open-sources";
import { useSourcePlayback } from "./source-playback";
import { sourceError } from "./source-screens";

/**
 * Reports an item's state (`null`: the item left) and a getter of its latest controls to the bridge
 * that draws the items.
 */
export type ItemReport<S, C> = (key: string, state: S | null, controls: (() => C) | null) => void;

/** States of invisible per-item components (`useReportItem`) by key; `control(key)` gives one's controls. */
export function useReportedItems<S, C>() {
  const [states, setStates] = useState<Record<string, S>>({});
  const controls = useRef(new Map<string, () => C>());
  const report = useCallback<ItemReport<S, C>>((key, state, control) => {
    if (control) controls.current.set(key, control);
    else controls.current.delete(key);
    setStates((current) => {
      const next = { ...current };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  }, []);
  const control = useCallback((key: string) => controls.current.get(key)?.(), []);
  return { states, report, control };
}

/** Sends an item's state (plain JSON) when it changes, and its removal when the item unmounts. */
export function useReportItem<S, C>(key: string, state: S, controls: C, report: ItemReport<S, C>) {
  const snapshot = JSON.stringify(state);
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });
  useEffect(() => {
    report(key, JSON.parse(snapshot) as S, () => latest.current);
  }, [key, snapshot, report]);
  useEffect(() => () => report(key, null, null), [key, report]);
}

export type PlayerControls = {
  toggle: () => void;
  seek: (ms: number) => void;
  toggleMute: () => void;
};
export type PlayerReport = ItemReport<NativePlayback, PlayerControls>;

export const playerKey = ({ kind, id }: NativePlaybackTarget) => `${kind}:${id}`;

/** Player states reported by `useReportPlayer`, by key; `control(key)` gives that player's controls. */
export function useNativePlayers() {
  const { states, report, control } = useReportedItems<NativePlayback, PlayerControls>();
  return { players: states, report, control };
}

/**
 * Sends a player's state to the bridge. The position is rounded to 250 ms so a playing preview does not
 * resend the screen on every audio frame.
 */
export function useReportPlayer(
  key: string,
  state: NativePlayback,
  controls: PlayerControls,
  report: PlayerReport,
) {
  useReportItem(
    key,
    { ...state, positionMs: Math.floor(state.positionMs / 250) * 250 },
    controls,
    report,
  );
}

/**
 * The web's AudioPlaybackBar state of a `useSourcePlayback` player. The position is rounded to 250 ms,
 * as `useReportPlayer` does, for players reported along with other state.
 */
export function nativeSourcePlayback(
  player: Pick<NativePlayback, "playing" | "loading" | "muted" | "positionMs" | "durationMs"> & {
    error: string;
  },
  label: string,
): NativePlayback {
  return {
    label,
    playing: player.playing,
    loading: player.loading,
    muted: player.muted,
    positionMs: Math.floor(player.positionMs / 250) * 250,
    durationMs: player.durationMs,
    disabled: false,
    error: player.error || null,
  };
}

/**
 * A sample's preview (the web's SourcePlayback, which must allow previews); its audio element stays
 * in this page. Reports as `id`.
 */
export function SourcePlayerReporter({
  id,
  sourceId,
  label = "샘플",
  durationMs = null,
  report,
}: {
  id: string;
  sourceId: number;
  label?: string;
  durationMs?: number | null;
  report: PlayerReport;
}) {
  const player = useSourcePlayback(sourceId, true, durationMs);
  useReportPlayer(id, nativeSourcePlayback(player, label), player, report);
  return <audio hidden {...player.audio} />;
}

/** The saved-sample library (the web's SavedSourceList) for the app; players are keyed `saved:<id>`. */
export function nativeSavedSources(
  saved: SavedOpenSourcesState,
  signedIn: boolean,
  players: Record<string, NativePlayback>,
): NativeSavedSources {
  const current = saved.current;
  if (!signedIn) return { state: "signed-out" };
  if (!current) return { state: "loading" };
  return {
    state: "ready",
    notice: saved.notice || null,
    empty:
      saved.items.length === 0 && current.next === null && !current.error
        ? saved.keyword
          ? "검색 결과가 없습니다."
          : "저장한 샘플이 없습니다."
        : null,
    items: saved.items.map((item) => ({
      openSourceId: item.openSourceId,
      source:
        item.availability === "AVAILABLE" && item.source
          ? {
              title: item.source.title,
              description: item.source.description || null,
              writer: item.source.writer.nickname,
              canPreview: item.source.canPreview ?? true,
              player: players[playerKey({ kind: "saved", id: item.openSourceId })] ?? null,
            }
          : null,
    })),
    unsavingId: saved.busy,
    locked: saved.busy !== null || current.busy,
    error: current.error ? sourceError(current.error.cause, "보관함을 불러오지 못했습니다.") : null,
    paging:
      current.next !== null
        ? {
            label: current.busy ? "불러오는 중..." : current.error ? "다시 시도" : "더보기",
            busy: current.busy || saved.busy !== null,
          }
        : null,
  };
}

/** The players of the saved samples that can be previewed. */
export function SavedSourcePlayers({
  saved,
  report,
}: {
  saved: SavedOpenSourcesState;
  report: PlayerReport;
}) {
  return saved.items.map((item) =>
    item.availability === "AVAILABLE" && item.source && (item.source.canPreview ?? true) ? (
      <SourcePlayerReporter
        key={item.openSourceId}
        id={playerKey({ kind: "saved", id: item.openSourceId })}
        sourceId={item.openSourceId}
        report={report}
      />
    ) : null,
  );
}

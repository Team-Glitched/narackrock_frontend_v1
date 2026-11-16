import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { useSavedOpenSources } from "@/features/sources/saved-open-sources";
import { useSourcePlayback } from "@/features/sources/source-playback";
import { sourceError } from "@/features/sources/source-screens";
import type { CompositionDto } from "@/lib/api/composition";
import type { NativeLibrary, NativePlayback, NativePlaybackTarget } from "@/lib/native-screens";
import { uiLabels } from "@/lib/ui-labels";
import { useSourceLibraryActions } from "./source-library-content";
import { useClipPlayer, useSourceLibrary } from "./workspace-screens";

type PlayerControls = { toggle: () => void; seek: (ms: number) => void; toggleMute: () => void };
type PlayerReport = (
  key: string,
  state: NativePlayback | null,
  controls: PlayerControls | null,
) => void;

const playerKey = ({ kind, id }: NativePlaybackTarget) => `${kind}:${id}`;

/**
 * Sends a player's state to the bridge. The position is rounded to 250 ms so a playing preview does not
 * resend the screen on every audio frame.
 */
function useReportPlayer(
  key: string,
  state: NativePlayback,
  controls: PlayerControls,
  report: PlayerReport,
) {
  const snapshot = JSON.stringify({
    ...state,
    positionMs: Math.floor(state.positionMs / 250) * 250,
  });
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });
  useEffect(() => {
    report(key, JSON.parse(snapshot) as NativePlayback, {
      toggle: () => latest.current.toggle(),
      seek: (ms) => latest.current.seek(ms),
      toggleMute: () => latest.current.toggleMute(),
    });
  }, [key, snapshot, report]);
  useEffect(() => () => report(key, null, null), [key, report]);
}

/** A local MIDI work's preview (the web's ClipPlayer), played by this page. */
function ClipPlayerReporter({
  id,
  composition,
  label,
  report,
}: {
  id: number;
  composition: CompositionDto;
  label: string;
  report: PlayerReport;
}) {
  const clip = useClipPlayer(composition);
  useReportPlayer(
    playerKey({ kind: "local", id }),
    {
      label,
      playing: clip.playing,
      loading: clip.loading,
      muted: clip.muted,
      positionMs: clip.positionMs,
      durationMs: clip.durationMs,
      disabled: clip.disabled,
      error: clip.error || null,
    },
    clip,
    report,
  );
  return null;
}

/** A saved sample's preview (the web's SourcePlayback); its audio element stays in this page. */
function SourcePlayerReporter({ id, report }: { id: number; report: PlayerReport }) {
  const player = useSourcePlayback(id, true, null);
  useReportPlayer(
    playerKey({ kind: "saved", id }),
    {
      label: "샘플",
      playing: player.playing,
      loading: player.loading,
      muted: player.muted,
      positionMs: player.positionMs,
      durationMs: player.durationMs,
      disabled: false,
      error: player.error || null,
    },
    player,
    report,
  );
  return <audio hidden {...player.audio} />;
}

/** In the app the sample library (SourceLibraryScreen) is drawn natively (native/screens/workspace/library.tsx). */
export function NativeLibraryBridge({
  onSearch,
  onBack,
}: {
  onSearch: () => void;
  onBack: () => void;
}) {
  const actions = useSourceLibraryActions(false);
  const library = useSourceLibrary(false, actions.onUse);
  const { targetResource, filter, items, busy, notice } = library;
  const signedIn = useCurrentUserId() !== null;
  const saved = useSavedOpenSources(
    library.query,
    signedIn && filter === "SERVER" && !targetResource,
  );
  const { requestLogin } = useLoginPrompt();

  const [players, setPlayers] = useState<Record<string, NativePlayback>>({});
  const controls = useRef(new Map<string, PlayerControls>());
  const report = useCallback<PlayerReport>((key, state, control) => {
    if (control) controls.current.set(key, control);
    else controls.current.delete(key);
    setPlayers((current) => {
      const next = { ...current };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  }, []);

  let model: NativeLibrary;
  if (targetResource) {
    const { works, error, loading, appending, hasMore } = library.visited;
    model = {
      view: "pick-work",
      subtitle: `${targetResource.title} 레이어를 추가할 곡을 선택하세요.`,
      error,
      loading,
      empty:
        works.length === 0 && !loading && !hasMore && !error
          ? "작업 중인 곡이 없습니다. 새 곡을 만든 뒤 레이어 추가에서 보관함을 열어주세요."
          : null,
      works: works.map((work) => ({
        id: work.id,
        title: work.title,
        meta: `${work.composition.tracks.length}개 레이어 · ${work.shortId === null ? uiLabels.myMusic : "참여한 작업"}`,
      })),
      busy: busy !== null,
      paging: hasMore ? { busy: appending } : null,
      notice: notice || null,
    };
  } else {
    const current = saved.current;
    model = {
      view: "library",
      title: uiLabels.sourceLibrary,
      subtitle: "보관한 샘플은 계정에, MIDI 작업은 이 기기에 저장됩니다.",
      filter,
      query: library.query,
      notice: notice || null,
      local:
        filter === "LOCAL"
          ? {
              items: items.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                saved: r.saved,
                player: players[playerKey({ kind: "local", id: r.id })] ?? null,
              })),
              empty:
                items.length === 0
                  ? "이 기기에 남아 있는 MIDI 작업이 없습니다. 이전 작업은 설정의 데이터 이관·복구에서 내보낼 수 있습니다."
                  : null,
            }
          : null,
      saved:
        filter !== "SERVER"
          ? null
          : !signedIn
            ? { state: "signed-out" }
            : !current
              ? { state: "loading" }
              : {
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
                            player:
                              players[playerKey({ kind: "saved", id: item.openSourceId })] ?? null,
                          }
                        : null,
                  })),
                  unsavingId: saved.busy,
                  locked: saved.busy !== null || current.busy,
                  error: current.error
                    ? sourceError(current.error.cause, "보관함을 불러오지 못했습니다.")
                    : null,
                  paging:
                    current.next !== null
                      ? {
                          label: current.busy
                            ? "불러오는 중..."
                            : current.error
                              ? "다시 시도"
                              : "더보기",
                          busy: current.busy || saved.busy !== null,
                        }
                      : null,
                },
      busyId: busy,
    };
  }

  const node = useNativeScreen("workspace-library", model, {
    header: { left: "back", actions: ["notifications", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "filter":
          return library.setFilter(action.filter);
        case "query":
          return library.setQuery(action.value);
        case "toggle-favorite":
          return library.toggleFavorite(action.id);
        case "use": {
          const resource = items.find((r) => r.id === action.id);
          if (resource) void library.use(resource);
          return;
        }
        case "pick": {
          const work = library.visited.works.find((w) => w.id === action.workId);
          if (targetResource && work) void library.use(targetResource, work);
          return;
        }
        case "cancel-pick":
          return library.setTargetResource(null);
        case "start-song":
          return actions.onStartSong();
        case "open-sources":
          return actions.onOpenSources();
        case "open-source":
          return actions.onOpenSource(action.openSourceId);
        case "unsave":
          return saved.unsave(action.openSourceId);
        case "sign-in":
          return requestLogin();
        case "play":
          return controls.current.get(playerKey(action.target))?.toggle();
        case "seek":
          return controls.current.get(playerKey(action.target))?.seek(action.ms);
        case "mute":
          return controls.current.get(playerKey(action.target))?.toggleMute();
        case "more":
          return targetResource ? library.visited.more() : saved.more();
      }
    },
  });

  return (
    <>
      {node}
      {!targetResource &&
        filter === "LOCAL" &&
        items.map((r) => (
          <ClipPlayerReporter
            key={r.id}
            id={r.id}
            composition={r.composition}
            label={`${r.title} 미리듣기`}
            report={report}
          />
        ))}
      {!targetResource &&
        filter === "SERVER" &&
        saved.items.map((item) =>
          item.availability === "AVAILABLE" && item.source && (item.source.canPreview ?? true) ? (
            <SourcePlayerReporter key={item.openSourceId} id={item.openSourceId} report={report} />
          ) : null,
        )}
    </>
  );
}

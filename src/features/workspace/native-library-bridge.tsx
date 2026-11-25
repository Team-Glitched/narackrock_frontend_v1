import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { compositionDurationMs } from "@/features/composition/playback-duration";
import {
  idlePlayback,
  nativeSavedSources,
  playerKey,
  SavedSourcePlayers,
  useNativePlayers,
  useReportPlayer,
  type PlayerReport,
} from "@/features/sources/native-source-players";
import { useSavedOpenSources } from "@/features/sources/saved-open-sources";
import type { CompositionDto } from "@/lib/api/composition";
import type { NativeLibrary } from "@/lib/native-screens";
import { uiLabels } from "@/lib/ui-labels";
import { useSourceLibraryActions } from "./source-library-content";
import { useClipPlayer, useSourceLibrary } from "./workspace-screens";

/** The web ClipPlayer label of a local MIDI work. */
const clipLabel = (title: string) => `${title} 미리듣기`;

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

/**
 * In the app the sample library (SourceLibraryScreen) is drawn natively (native/screens/workspace/library.tsx);
 * `importing` is the studio's "MIDI 가져오기" (/studio/:projectId/import).
 */
export function NativeLibraryBridge({
  onSearch,
  onBack,
  importing = false,
}: {
  onSearch: () => void;
  onBack: () => void;
  importing?: boolean;
}) {
  const actions = useSourceLibraryActions(importing);
  const library = useSourceLibrary(importing, actions.onUse);
  const { targetResource, filter, items, busy, notice } = library;
  const signedIn = useCurrentUserId() !== null;
  const saved = useSavedOpenSources(
    library.query,
    signedIn && !importing && filter === "SERVER" && !targetResource,
  );
  const { requestLogin } = useLoginPrompt();
  const { players, report, control } = useNativePlayers();

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
    model = {
      view: "library",
      importing,
      title: importing ? "MIDI 가져오기" : uiLabels.sourceLibrary,
      subtitle: importing
        ? "이 기기에 남아 있는 MIDI 작업을 개인 초안으로 가져옵니다."
        : "보관한 샘플은 계정에, MIDI 작업은 이 기기에 저장됩니다.",
      filter,
      query: library.query,
      notice: notice || null,
      local:
        filter === "LOCAL"
          ? {
              items: items.map((r) => {
                const durationMs = compositionDurationMs(r.composition);
                return {
                  id: r.id,
                  title: r.title,
                  description: r.description,
                  saved: r.saved,
                  player:
                    players[playerKey({ kind: "local", id: r.id })] ??
                    idlePlayback(clipLabel(r.title), durationMs, durationMs === 0),
                };
              }),
              empty:
                items.length === 0
                  ? "이 기기에 남아 있는 MIDI 작업이 없습니다. 이전 작업은 설정의 데이터 이관·복구에서 내보낼 수 있습니다."
                  : null,
            }
          : null,
      saved:
        !importing && filter === "SERVER" ? nativeSavedSources(saved, signedIn, players) : null,
      busyId: busy,
    };
  }

  const node = useNativeScreen("workspace-library", model, {
    // /studio/:projectId/import keeps the web's minimal Header (back only).
    header: importing
      ? { left: "back", actions: [] }
      : { left: "back", actions: ["notifications", "chat", "search", "account"] },
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
          return control(playerKey(action.target))?.toggle();
        case "seek":
          return control(playerKey(action.target))?.seek(action.ms);
        case "mute":
          return control(playerKey(action.target))?.toggleMute();
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
            label={clipLabel(r.title)}
            report={report}
          />
        ))}
      {!targetResource && filter === "SERVER" && (
        <SavedSourcePlayers saved={saved} report={report} />
      )}
    </>
  );
}

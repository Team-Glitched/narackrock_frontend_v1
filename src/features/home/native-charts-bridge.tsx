import { useHomeSongs } from "@/features/home/use-home-songs";
import { nativeSong } from "@/features/navigation/native-models";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { uiLabels } from "@/lib/ui-labels";
import type { NativeCharts, NativeChartSong } from "@/lib/native-screens";
import { useMyMusic, type MusicListTab, type SongChartKind } from "./home-screens";

const songStatus = { loading: "곡을 불러오는 중...", error: "곡을 불러오지 못했습니다." };

/** "내 음악" (the web's MySongsChart) as a native chart model. */
function useMyMusicChart(tab: MusicListTab, featuredUserId: number | undefined) {
  const music = useMyMusic(tab, featuredUserId);
  const { profile, songs, canManageFeatured, otherFeatured, activeTab, pinnedIds } = music;
  const managing = canManageFeatured && profile.data !== undefined;

  let chart: NativeCharts;
  const base = {
    title: otherFeatured ? uiLabels.featuredMusic : uiLabels.myMusic,
    tab: otherFeatured ? null : activeTab,
    hint: managing ? "내 작업물이나 내 참가작에서 별표를 눌러 대표 음악으로 설정할 수 있어요." : null,
    menu: false,
    starBusy: music.savingId !== null,
  };
  if (activeTab === "featured") {
    const pinned = [...(profile.data?.activities.pinnedShorts ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    chart = {
      ...base,
      notice: music.featureNotice,
      status: music.targetUserId === null ? "signed-out" : profile.isError ? "error" : profile.data ? "ready" : "loading",
      error: profile.isError
        ? profile.error instanceof Error ? profile.error.message : "대표 음악을 불러오지 못했습니다."
        : null,
      items: pinned.map((song) => ({
        shortId: song.shortId,
        title: song.title,
        author: profile.data?.nickname ?? "",
        albumImageUrl: song.albumImageUrl,
        ownerId: profile.data?.userId ?? 0,
        star: canManageFeatured ? "pinned" : null,
      })),
      emptyMessage: canManageFeatured
        ? "아직 등록한 대표 음악이 없습니다.\n내 작업물이나 내 참가작에서 별표를 눌러 설정해 보세요."
        : "아직 등록한 대표 음악이 없습니다.",
      paging: null,
    };
  } else {
    chart = {
      ...base,
      notice: music.featureNotice ?? (songs.status === "ready" ? songs.error : null),
      status: songs.status,
      error: songs.status === "error" ? (songs.error ?? songStatus.error) : null,
      items: music.items.map((song): NativeChartSong => {
        const isPinned = pinnedIds.has(song.shortId);
        return { ...nativeSong(song), star: managing ? (isPinned ? "pinned" : "unpinned") : null };
      }),
      emptyMessage: songs.hasMore
        ? "아직 이 종류의 곡을 찾지 못했습니다. 다음 목록도 확인해 주세요."
        : activeTab === "authored"
          ? "아직 작성한 곡이 없습니다."
          : "아직 참가한 곡이 없습니다.",
      paging:
        songs.status === "ready" && songs.hasMore
          ? {
              label: songs.appending ? "불러오는 중..." : songs.error ? "다음 목록 다시 시도" : "더보기",
              busy: songs.appending,
              failure: null,
            }
          : null,
    };
  }

  function toggleStar(shortId: number) {
    const song =
      music.items.find((item) => item.shortId === shortId) ??
      profile.data?.activities.pinnedShorts.find((item) => item.shortId === shortId);
    if (song) void music.toggleFeatured(song);
  }
  return { chart, toggleStar, more: songs.loadMore, retry: activeTab === "featured" ? () => void profile.refetch() : songs.retry, clearNotice: music.clearNotice };
}

/** Popular / recommended (the web's RankedSongsChart) as a native chart model. */
function useRankedChart(kind: "popular" | "recommended") {
  const { popular, recommended } = useHomeSongs(100, kind);
  const selected = kind === "popular" ? popular : recommended;
  const chart: NativeCharts = {
    title: kind === "popular" ? "인기 차트" : "추천",
    tab: null,
    hint: null,
    notice: null,
    status: selected.status,
    error: selected.status === "error" ? songStatus.error : null,
    items: selected.items.map((song) => ({ ...nativeSong(song), star: null })),
    emptyMessage: "아직 표시할 곡이 없어요.",
    menu: true,
    starBusy: false,
    paging:
      kind === "recommended" && recommended.hasMore
        ? {
            label: recommended.appending
              ? "불러오는 중..."
              : recommended.expired
                ? "추천 다시 불러오기"
                : recommended.appendFailed
                  ? "다시 시도"
                  : "더 보기",
            busy: recommended.appending,
            failure: recommended.appendFailed
              ? recommended.expired ? "추천 목록이 만료됐습니다." : "다음 곡을 불러오지 못했습니다."
              : null,
          }
        : null,
  };
  return { chart, more: recommended.loadMore, retry: recommended.retry };
}

type ChartsBridgeProps = {
  tab: MusicListTab;
  featuredUserId?: number;
  onTabChange: (tab: MusicListTab) => void;
  onOpenShort: (shortId: number) => void;
  onSearch: () => void;
  onBack: () => void;
};

type ChartControls = {
  chart: NativeCharts;
  more: () => void;
  retry: () => void;
  toggleStar?: (shortId: number) => void;
  clearNotice?: () => void;
};

function useChartScreen(
  { chart, more, retry, toggleStar, clearNotice }: ChartControls,
  { onTabChange, onOpenShort, onSearch, onBack }: ChartsBridgeProps,
) {
  return useNativeScreen("charts", chart, {
    header: { left: "back", actions: ["notifications", "chat", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "tab":
          clearNotice?.();
          return onTabChange(action.tab);
        case "star":
          return toggleStar?.(action.shortId);
        case "retry":
          return retry();
        case "more":
          return more();
        case "open-short":
          return onOpenShort(action.shortId);
      }
    },
  });
}

// Separate components so each kind only runs (and fetches) its own data hooks.
function MyMusicBridge(props: ChartsBridgeProps) {
  return useChartScreen(useMyMusicChart(props.tab, props.featuredUserId), props);
}

function RankedBridge({ kind, ...props }: ChartsBridgeProps & { kind: "popular" | "recommended" }) {
  return useChartScreen(useRankedChart(kind), props);
}

/** In the app the charts page is drawn natively (native/screens/charts.tsx). */
export function NativeChartsBridge({ kind, ...props }: ChartsBridgeProps & { kind: SongChartKind }) {
  return kind === "mine" ? <MyMusicBridge {...props} /> : <RankedBridge kind={kind} {...props} />;
}

import { partLabel } from "@/features/composition/instrument-parts";
import { useState, type ReactNode } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { OpenSourceSummary } from "@/lib/api/open-sources";
import { pickNativeImage } from "@/lib/native-app";
import type {
  NativeHeader,
  NativeMoreAction,
  NativePlayback,
  NativeSourceCard,
  NativeSourceRail,
  NativeSources,
  NativeSourcesAction,
} from "@/lib/native-screens";
import {
  nativeSavedSources,
  nativeSourcePlayback,
  playerKey,
  SavedSourcePlayers,
  useNativePlayers,
  useReportedItems,
  useReportItem,
  type ItemReport,
  type PlayerControls,
} from "./native-source-players";
import { useSavedOpenSources } from "./saved-open-sources";
import { useSourcePlayback } from "./source-playback";
import { useSourcePublications } from "./source-publications";
import { sourceError, sourceUsage, useOpensourceFeed, useSourceSave } from "./source-screens";

/** The web /sources Header: logo, notifications, chat, search, account. */
const header: NativeHeader = { left: "logo", actions: ["notifications", "chat", "search", "account"] };

type Tab = NativeSources["tab"];

export type SourcesNavigation = {
  onHome: () => void;
  onTab: (tab: Tab) => void;
  onCreate: () => void;
  onOpen: (openSourceId: number, comments?: boolean) => void;
  onProfile: (userId: number) => void;
  onSearch: () => void;
};

type TabAction = NativeSourcesAction | NativeMoreAction;

/**
 * In the app /sources (SourcesPage) is drawn natively (native/screens/sources/sources.tsx). Render it
 * keyed by tab, as the web remounts the tab content: each tab reads its own data.
 */
export function NativeSourcesBridge({ tab, nav }: { tab: Tab; nav: SourcesNavigation }) {
  const signedIn = useCurrentUserId() !== null;
  if (tab === "feed") return <FeedBridge nav={nav} />;
  if (tab === "saved") return <SavedBridge nav={nav} />;
  return signedIn ? <MineBridge nav={nav} /> : <MineSignedOutBridge nav={nav} />;
}

/** The screen of one tab: the tab bar, navigation and the login prompt are handled here. */
function useSourcesScreen(
  tab: Tab,
  part: Partial<Pick<NativeSources, "feed" | "saved" | "mine">>,
  nav: SourcesNavigation,
  onAction?: (action: TabAction) => void,
): ReactNode {
  const { requestLogin } = useLoginPrompt();
  const model: NativeSources = {
    tab,
    feed: null,
    saved: null,
    mine: null,
    create: tab !== "saved",
    ...part,
  };
  return useNativeScreen("sources", model, {
    header,
    onSearch: nav.onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "sources-home":
          return nav.onHome();
        case "sources-tab":
          return nav.onTab(action.tab);
        case "sources-create":
          return nav.onCreate();
        case "sources-open":
          return nav.onOpen(action.openSourceId, action.comments);
        case "open-source":
          return nav.onOpen(action.openSourceId);
        case "sources-profile":
          return nav.onProfile(action.userId);
        case "sign-in":
          return requestLogin();
        default:
          return onAction?.(action);
      }
    },
  });
}

type CardState = { saveBusy: boolean; saveError: string | null; player: NativePlayback | null };
type CardControls = PlayerControls & { save: () => void };

/** One card's save button and preview (the web's OpenSourceCard); its audio element stays here. */
function SourceCardReporter({
  id,
  source,
  report,
}: {
  id: string;
  source: OpenSourceSummary;
  report: ItemReport<CardState, CardControls>;
}) {
  const save = useSourceSave(source);
  const canPreview = source.canPreview ?? true;
  const player = useSourcePlayback(source.openSourceId, canPreview, null);
  useReportItem(
    id,
    {
      saveBusy: save.busy,
      saveError: save.error || null,
      player: canPreview ? nativeSourcePlayback(player, source.title) : null,
    },
    { ...player, save: save.toggle },
    report,
  );
  return canPreview ? <audio hidden {...player.audio} /> : null;
}

const feedSections = ["popular", "recommended", "all"] as const;

/** The 탐색 tab (the web's OpensourceScreen). */
function FeedBridge({ nav }: { nav: SourcesNavigation }) {
  const { list, popular, recommended } = useOpensourceFeed();
  const cards = useReportedItems<CardState, CardControls>();
  const { state } = list;
  const sections = {
    popular: popular.data?.items,
    recommended,
    all: state?.items,
  };
  const card =
    (section: (typeof feedSections)[number]) =>
    (source: OpenSourceSummary): NativeSourceCard => {
      const key = `${section}:${source.openSourceId}`;
      const reported = cards.states[key];
      return {
        key,
        openSourceId: source.openSourceId,
        title: source.title,
        instrumentLabel: source.instrument ? partLabel(source.instrument) : null,
        thumbnailUrl: source.thumbnailUrl,
        usage: source.usageCount != null ? sourceUsage(source.usageCount) : null,
        description: source.description ?? "",
        writer: {
          userId: source.writer.userId,
          nickname: source.writer.nickname,
          profileImageUrl: source.writer.profileImageUrl,
        },
        likeCount: source.likeCount,
        dislikeCount: source.dislikeCount,
        commentCount: source.commentCount,
        saved: source.isSaved,
        saveBusy: reported?.saveBusy ?? false,
        saveError: reported?.saveError ?? null,
        canPreview: source.canPreview ?? true,
        player: reported?.player ?? null,
        vote: source.isLiked ? "like" : source.isDisliked ? "dislike" : null,
      };
    };
  const rail = (
    title: string,
    section: "popular" | "recommended",
    error: string | undefined,
  ): NativeSourceRail => ({
    title,
    items: sections[section]?.map(card(section)) ?? null,
    error: error ?? null,
  });
  const node = useSourcesScreen(
    "feed",
    {
      feed: !list.signedIn
        ? { state: "signed-out" }
        : {
            state: "ready",
            popular: rail(
              "인기 샘플",
              "popular",
              popular.error ? sourceError(popular.error) : undefined,
            ),
            recommended: rail("추천 샘플", "recommended", state?.error),
            all: {
              loading: !state,
              error: state?.error ?? null,
              empty: !!state && !state.error && state.items.length === 0,
              items: state?.items.map(card("all")) ?? [],
              more: state?.hasNext ? { busy: list.moreBusy } : null,
            },
          },
    },
    nav,
    (action) => {
      switch (action.type) {
        case "sources-rail-retry":
          return action.rail === "popular" ? void popular.refetch() : list.retry();
        case "more":
          return list.more();
        case "sources-save":
          return cards.control(action.key)?.save();
        case "sources-play":
          return cards.control(action.key)?.toggle();
        case "sources-seek":
          return cards.control(action.key)?.seek(action.ms);
        case "sources-mute":
          return cards.control(action.key)?.toggleMute();
      }
    },
  );
  return (
    <>
      {node}
      {list.signedIn &&
        feedSections.map((section) =>
          sections[section]?.map((source) => (
            <SourceCardReporter
              key={`${section}:${source.openSourceId}`}
              id={`${section}:${source.openSourceId}`}
              source={source}
              report={cards.report}
            />
          )),
        )}
    </>
  );
}

/** The 보관함 tab (the web's SavedOpenSources), drawn like the library's saved samples. */
function SavedBridge({ nav }: { nav: SourcesNavigation }) {
  const signedIn = useCurrentUserId() !== null;
  const saved = useSavedOpenSources("", signedIn);
  const { players, report, control } = useNativePlayers();
  const node = useSourcesScreen(
    "saved",
    { saved: nativeSavedSources(saved, signedIn, players) },
    nav,
    (action) => {
      switch (action.type) {
        case "unsave":
          return saved.unsave(action.openSourceId);
        case "play":
          return control(playerKey(action.target))?.toggle();
        case "seek":
          return control(playerKey(action.target))?.seek(action.ms);
        case "mute":
          return control(playerKey(action.target))?.toggleMute();
        case "more":
          return saved.more();
      }
    },
  );
  return (
    <>
      {node}
      {signedIn && <SavedSourcePlayers saved={saved} report={report} />}
    </>
  );
}

function MineSignedOutBridge({ nav }: { nav: SourcesNavigation }) {
  return useSourcesScreen("mine", { mine: { state: "signed-out" } }, nav);
}

/** The 내 등록 tab (the web's SourcePublications). */
function MineBridge({ nav }: { nav: SourcesNavigation }) {
  const publications = useSourcePublications();
  const { list, items, editor, busy } = publications;
  // The photo picker's own failure (e.g. an unsupported format); cleared by the next pick.
  const [pickError, setPickError] = useState<string | null>(null);
  const node = useSourcesScreen(
    "mine",
    {
      mine: editor
        ? {
            state: "editor",
            notice: publications.notice || null,
            openSourceId: editor.source.openSourceId,
            public: editor.source.visibility === "PUBLIC",
            title: editor.title,
            description: editor.description,
            thumbnail: editor.thumbnail,
            hasThumbnail: editor.source.thumbnailMediaFileId !== null,
            fileName: editor.file?.name ?? null,
            error: pickError ?? (publications.editorError || null),
            locked: busy !== null,
            saving: busy?.kind === "save",
            confirmDelete: publications.confirmDelete
              ? { title: editor.source.title, error: publications.deleteError || null }
              : null,
            deleting: busy?.kind === "delete",
          }
        : {
            state: "list",
            notice: publications.notice || null,
            loading: publications.loading,
            error: publications.listError || null,
            empty:
              !!list.data && !publications.loading && !publications.listError && items.length === 0,
            items: items.map((source) => ({
              openSourceId: source.openSourceId,
              title: source.title,
              instrumentLabel: source.instrument ? partLabel(source.instrument) : null,
              description: source.description || null,
              public: source.visibility === "PUBLIC",
              managing: busy?.kind === "manage" && busy.id === source.openSourceId,
              switching: busy?.kind === "visibility" && busy.id === source.openSourceId,
            })),
            locked: busy !== null,
            fetching: list.isFetching,
            more: list.hasNextPage && !publications.listError,
          },
    },
    nav,
    (action) => {
      const edit = (patch: { title: string } | { description: string }) =>
        publications.setEditor((old) => (old ? { ...old, ...patch } : old));
      switch (action.type) {
        case "sources-manage":
          return publications.manageSource(action.openSourceId);
        case "sources-visibility": {
          const source = items.find((item) => item.openSourceId === action.openSourceId);
          if (source) publications.toggleVisibility(source);
          return;
        }
        case "sources-publications-page":
        case "more":
          return publications.requestPage();
        case "sources-editor-title":
          return edit({ title: action.value });
        case "sources-editor-description":
          return edit({ description: action.value });
        case "sources-editor-thumbnail":
          return publications.setEditor((old) =>
            old ? { ...old, thumbnail: action.thumbnail } : old,
          );
        case "sources-editor-pick":
          setPickError(null);
          void pickNativeImage().then(
            (file) => {
              if (file) publications.pickThumbnail(file);
            },
            (cause: unknown) =>
              setPickError(
                cause instanceof Error ? cause.message : "이미지를 선택하지 못했습니다.",
              ),
          );
          return;
        case "sources-editor-save":
          setPickError(null);
          return publications.submit();
        case "sources-editor-close":
          setPickError(null);
          return publications.closeEditor();
        case "sources-delete-open":
          return publications.openDelete();
        case "sources-delete-cancel":
          if (!publications.writing()) publications.setConfirmDelete(false);
          return;
        case "sources-delete-confirm":
          return publications.remove();
      }
    },
  );
  return node;
}

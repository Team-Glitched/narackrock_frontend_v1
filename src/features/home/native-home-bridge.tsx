import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { nativePost, nativeSong } from "@/features/navigation/native-models";
import { useVisitedWorks } from "@/features/workspace/use-visited-works";
import type { Work } from "@/features/workspace/workspace-store";
import { workingMusic } from "@/features/workspace/working-music";
import type { NativeHome, NativeWork } from "@/lib/native-screens";
import type { SongChartKind } from "./home-screens";

/** The same arrangement preview the web home draws: up to 4 tracks, clips as fractions of the song. */
function nativeWork(work: Work): NativeWork {
  const tracks = work.composition.tracks.slice(0, 4);
  const end = Math.max(1, ...tracks.flatMap((track) => track.clips.map((clip) => clip.startTick + clip.durationTick)));
  const visited = new Date(work.updatedAt);
  return {
    id: work.id,
    shortId: work.shortId,
    title: work.title,
    visitedLabel: Number.isNaN(visited.getTime())
      ? null
      : `${formatDistanceToNow(visited, { addSuffix: true, locale: ko })} 방문`,
    layerCount: work.composition.tracks.length,
    bpm: work.composition.project.bpm,
    preview: tracks.map((track) =>
      track.clips.map((clip) => ({ start: clip.startTick / end, length: clip.durationTick / end })),
    ),
  };
}

/** In the app the home is drawn natively (native/screens/home.tsx) from the web home's data. */
export function NativeHomeBridge({
  onSearch,
  onOpenPosts,
  onOpenWorkspace,
  onStartSong,
  onOpenPost,
  onOpenShort,
  onShowSongs,
  onResume,
}: {
  onSearch: () => void;
  onOpenPosts: () => void;
  onOpenWorkspace: () => void;
  onStartSong: () => void;
  onOpenPost: (postId: number) => void;
  onOpenShort: (shortId: number) => void;
  onShowSongs: (kind: SongChartKind) => void;
  onResume: (projectId: number, shortId: number | null) => void;
}) {
  const signedIn = useCurrentUserId() !== null;
  const songs = useHomeSongs();
  const posts = useGalleryPosts("popular");
  const visited = useVisitedWorks({ home: true, enabled: signedIn });

  const home: NativeHome = {
    works: signedIn
      ? { loading: visited.loading, error: visited.error, items: workingMusic(visited.works).slice(0, 3).map(nativeWork) }
      : null,
    popular: { status: songs.popular.status, items: songs.popular.items.map(nativeSong) },
    recommended: { status: songs.recommended.status, items: songs.recommended.firstPage.map(nativeSong) },
    posts:
      posts.status === "ready"
        ? { status: "ready", items: posts.posts.slice(0, 3).map(nativePost) }
        : { status: posts.status, items: [] },
    mine:
      songs.mine.status === "signed-out"
        ? null
        : { status: songs.mine.status, items: songs.mine.items.map(nativeSong) },
  };

  return useNativeScreen("home", home, {
    header: { left: "logo", actions: ["notifications", "chat", "search", "account"] },
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "open-short":
          return onOpenShort(action.shortId);
        case "open-post":
          return onOpenPost(action.postId);
        case "show-songs":
          return onShowSongs(action.kind);
        case "resume":
          return onResume(action.projectId, action.shortId);
        case "open-posts":
          return onOpenPosts();
        case "open-workspace":
          return onOpenWorkspace();
        case "start-song":
          return onStartSong();
      }
    },
  });
}

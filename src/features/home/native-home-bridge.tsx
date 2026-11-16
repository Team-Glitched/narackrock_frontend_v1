import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { nativePost, nativeSong } from "@/features/navigation/native-models";
import { nativeWork } from "@/features/workspace/native-work";
import { useVisitedWorks } from "@/features/workspace/use-visited-works";
import { workingMusic } from "@/features/workspace/working-music";
import type { NativeHome } from "@/lib/native-screens";
import type { SongChartKind } from "./home-screens";

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
      ? {
          loading: visited.loading,
          error: visited.error,
          items: workingMusic(visited.works).slice(0, 3).map(nativeWork),
        }
      : null,
    popular: { status: songs.popular.status, items: songs.popular.items.map(nativeSong) },
    recommended: {
      status: songs.recommended.status,
      items: songs.recommended.firstPage.map(nativeSong),
    },
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

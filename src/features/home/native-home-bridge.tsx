import { useWebModalOpen } from "@/hooks/use-web-modal-open";
import { useEffect, useEffectEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { FigmaSheet } from "@/components/figma-sheet";
import { useAuthSession } from "@/features/auth/auth-session";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { unreadNotificationsQuery } from "@/features/notifications/notification-queries";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { relativeTime } from "@/features/posts/post-utils";
import { unreadChatQuery } from "@/features/social/chat-queries";
import { useVisitedWorks } from "@/features/workspace/use-visited-works";
import type { Work } from "@/features/workspace/workspace-store";
import { workingMusic } from "@/features/workspace/working-music";
import { ApiError } from "@/lib/api/client";
import { getPostShareLink } from "@/lib/api/community";
import { canonicalShareLink } from "@/lib/api/content-link";
import { reportPost, reportShort } from "@/lib/api/reports";
import { getShortShareLink } from "@/lib/api/shorts";
import type { SongCardDto } from "@/lib/api/contracts";
import { onHomeAction, requestNative } from "@/lib/native-app";
import type {
  NativeContentKind,
  NativeHome,
  NativeHomeAction,
  NativeSong,
  NativeWork,
} from "@/lib/native-bridge-protocol";
import { publicWebOrigin } from "@/lib/public-web-origin";
import { queryScope } from "@/lib/query";
import { shareLink } from "@/lib/share-link";
import { postError } from "@/features/posts/post-utils";
import type { SongChartKind } from "./home-screens";

function nativeSong(song: SongCardDto): NativeSong {
  return {
    shortId: song.shortId,
    title: song.title,
    author: song.author.nickname,
    albumImageUrl: song.albumImageUrl,
    ownerId: song.author.userId,
  };
}

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

/**
 * In the app the home is drawn natively (native/home-screen.tsx). This keeps the web home's data
 * (same hooks as HomeScreen, so the same session, cache and local stores) flowing to it as a view
 * model, and performs the user's actions with the web's navigation, login prompt and report sheet.
 */
export function NativeHomeBridge({
  onSearch,
  onOpenPosts,
  onOpenWorkspace,
  onStartSong,
  onOpenPost,
  onOpenShort,
  onShowSongs,
  onResume,
  onNavigate,
}: {
  onSearch: () => void;
  onOpenPosts: () => void;
  onOpenWorkspace: () => void;
  onStartSong: () => void;
  onOpenPost: (postId: number) => void;
  onOpenShort: (shortId: number) => void;
  onShowSongs: (kind: SongChartKind) => void;
  onResume: (projectId: number, shortId: number | null) => void;
  /** Header destinations: "/chat", "/login" (returning here) and "/profile". */
  onNavigate: (to: "chat" | "login" | "profile") => void;
}) {
  const { currentUserId: userId, headerProfileImageUrl } = useAuthSession();
  const signedIn = userId !== null;
  const songs = useHomeSongs();
  const posts = useGalleryPosts("popular");
  const visited = useVisitedWorks({ home: true, enabled: signedIn });
  const notifications = useQuery(unreadNotificationsQuery(userId));
  const chats = useQuery(unreadChatQuery(userId));
  const { openNotifications } = useNotificationsNavigation();
  const { requireLogin } = useLoginPrompt();
  const queryClient = useQueryClient();
  const [report, setReport] = useState<{ kind: NativeContentKind; id: number } | null>(null);
  const [refreshed, setRefreshed] = useState(0);

  const home: NativeHome = {
    userId,
    profileImageUrl: headerProfileImageUrl,
    unreadNotifications: signedIn ? (notifications.data?.count ?? 0) : 0,
    unreadChats: signedIn ? (chats.data?.count ?? 0) : 0,
    works: signedIn
      ? { loading: visited.loading, error: visited.error, items: workingMusic(visited.works).slice(0, 3).map(nativeWork) }
      : null,
    popular: { status: songs.popular.status, items: songs.popular.items.map(nativeSong) },
    recommended: { status: songs.recommended.status, items: songs.recommended.firstPage.map(nativeSong) },
    posts:
      posts.status === "ready"
        ? {
            status: "ready",
            items: posts.posts.slice(0, 3).map((post) => ({
              postId: post.postId,
              title: post.title,
              excerpt: post.contentPreview || post.title,
              imageUrl: post.imageUrl,
              writer: { nickname: post.writer.nickname, profileImageUrl: post.writer.profileImageUrl },
              ownerId: post.writer.userId,
              createdLabel: relativeTime(post.createdAt),
              likeCount: post.likeCount,
              dislikeCount: post.dislikeCount ?? 0,
              commentCount: post.commentCount,
            })),
          }
        : { status: posts.status, items: [] },
    mine:
      songs.mine.status === "signed-out"
        ? null
        : { status: songs.mine.status, items: songs.mine.items.map(nativeSong) },
    refreshed,
  };

  // Sent only when it changes; the app keeps the last one while the page stays mounted.
  const snapshot = JSON.stringify(home);
  useEffect(() => {
    void requestNative("set-home", { home: JSON.parse(snapshot) as NativeHome });
  }, [snapshot]);
  useEffect(() => () => void requestNative("set-home", { home: null }), []);

  // The native home covers this page; screen readers must not reach it underneath. A modal hides
  // the native home (and may live inside #root, like the notifications sheet), so it lifts this.
  const modalOpen = useWebModalOpen();
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || modalOpen) return;
    root.setAttribute("aria-hidden", "true");
    return () => root.removeAttribute("aria-hidden");
  }, [modalOpen]);

  async function share(kind: NativeContentKind, id: number, title: string) {
    try {
      const { shareUrl } = await (kind === "post" ? getPostShareLink(id) : getShortShareLink(id));
      await shareLink(title, canonicalShareLink(kind, id, shareUrl, publicWebOrigin()));
    } catch (cause) {
      // The WebView turns alert() into a native dialog.
      window.alert(cause instanceof ApiError ? cause.message : postError(cause));
    }
  }

  const act = useEffectEvent((action: NativeHomeAction) => {
    switch (action.type) {
      case "open-short":
        return onOpenShort(action.shortId);
      case "open-post":
        return onOpenPost(action.postId);
      case "show-songs":
        return onShowSongs(action.kind);
      case "resume":
        return onResume(action.projectId, action.shortId);
      case "share":
        if (requireLogin()) void share(action.kind, action.id, action.title);
        return;
      case "report":
        if (requireLogin()) setReport({ kind: action.kind, id: action.id });
        return;
      case "open-posts":
        return onOpenPosts();
      case "open-workspace":
        return onOpenWorkspace();
      case "start-song":
        return onStartSong();
      case "search":
        return onSearch();
      case "notifications":
        return openNotifications();
      case "chat":
      case "login":
      case "profile":
        return onNavigate(action.type);
      case "refresh":
        // Resolves once the active queries refetched, whether or not they succeeded.
        void queryClient
          .invalidateQueries({ queryKey: queryScope(userId) })
          .finally(() => setRefreshed((count) => count + 1));
        return;
    }
  });
  useEffect(() => onHomeAction((action) => act(action)), []);

  // A web modal: while it is open the app shows the WebView, so the sheet is visible over the web home.
  return report && signedIn ? (
    <FigmaSheet key={`${report.kind}-${report.id}`} title="신고" onClose={() => setReport(null)}>
      <ReportReasons
        onSubmit={(reason, description) =>
          report.kind === "post" ? reportPost(report.id, reason, description) : reportShort(report.id, reason, description)
        }
        onDone={() => setReport(null)}
      />
    </FigmaSheet>
  ) : null;
}

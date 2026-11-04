import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { HomeWorkSection } from "@/features/workspace/home-work-section";
import { uiLabels } from "@/lib/ui-labels";
import { Asset } from "@/components/ui/asset";
import { SectionTitle } from "@/components/ui/section-title";
import { SongRail } from "@/features/home/song-rail";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { MiniPost, PostListStatus } from "@/features/posts/post-list";

function SongRailStatus({ state }: { state: "loading" | "error" | "empty" | "signed-out" }) {
  const message =
    state === "loading"
      ? "곡을 불러오는 중..."
      : state === "error"
        ? "곡을 불러오지 못했습니다."
        : state === "signed-out"
          ? "로그인하면 음악 목록을 확인할 수 있습니다."
          : "아직 표시할 곡이 없어요.";
  return <p className={sharedStyles.songRailStatus}>{message}</p>;
}

export type SongChartKind = "popular" | "mine" | "recommended";

export function HomeScreen({
  onOpenPosts,
  onOpenWorkspace,
  onStartSong,
  onOpenPost,
  onOpenShort,
  onShowSongs,
  onResume,
}: {
  onResume: (projectId: number, shortId: number | null) => void;
  onOpenPosts: () => void;
  onOpenWorkspace: () => void;
  onStartSong: () => void;
  onOpenPost: (postId: number) => void;
  onOpenShort: (shortId: number) => void;
  onShowSongs: (kind: SongChartKind) => void;
}) {
  const posts = useGalleryPosts("popular");
  const songs = useHomeSongs();
  return (
    <div className={cn(sharedStyles.homeContent, sharedStyles.scrollContent)}>
      <HomeWorkSection onOpenWorkspace={onOpenWorkspace} onStartSong={onStartSong} onResume={onResume} />
      <section>
        <SectionTitle onAll={() => onShowSongs("popular")}>인기 차트</SectionTitle>
        {songs.popular.status !== "ready" ? (
          <SongRailStatus state={songs.popular.status} />
        ) : songs.popular.items.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          <SongRail songs={songs.popular.items} onOpen={onOpenShort} />
        )}
      </section>
      <section>
        <SectionTitle onAll={() => onShowSongs("recommended")}>추천 음악</SectionTitle>
        {songs.recommended.status !== "ready" ? (
          <SongRailStatus state={songs.recommended.status} />
        ) : songs.recommended.items.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          <SongRail songs={songs.recommended.items} onOpen={onOpenShort} />
        )}
      </section>
      <section>
        <SectionTitle onAll={onOpenPosts}>{uiLabels.popularPosts}</SectionTitle>
        <div className={communityStyles.miniPostList}>
          {posts.status !== "ready" ? (
            <PostListStatus state={posts.status} />
          ) : posts.posts.length === 0 ? (
            <PostListStatus state="empty" />
          ) : (
            posts.posts
              .slice(0, 3)
              .map((post) => <MiniPost key={post.postId} post={post} onOpen={onOpenPost} />)
          )}
        </div>
      </section>
      <section>
        <SectionTitle onAll={() => onShowSongs("mine")}>{uiLabels.myMusic}</SectionTitle>
        {songs.mine.status !== "ready" ? (
          <SongRailStatus state={songs.mine.status} />
        ) : songs.mine.items.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          <SongRail songs={songs.mine.items} onOpen={onOpenShort} />
        )}
      </section>
    </div>
  );
}

export function ChartsScreen({
  kind,
  onOpenShort,
}: {
  kind: SongChartKind;
  onOpenShort: (shortId: number) => void;
}) {
  const songs = useHomeSongs(100);
  const selected =
    kind === "popular" ? songs.popular : kind === "recommended" ? songs.recommended : songs.mine;
  return (
    <div className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>
        {kind === "popular" ? "인기 차트" : kind === "recommended" ? "추천 음악" : uiLabels.myMusic}
      </h1>
      <div className={sharedStyles.chartList}>
        {selected.status !== "ready" ? (
          <SongRailStatus state={selected.status} />
        ) : selected.items.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          selected.items.map((song) => (
            <button
              type="button"
              className={sharedStyles.chartRow}
              key={song.shortId}
              onClick={() => onOpenShort(song.shortId)}
            >
              <span className={sharedStyles.chartArt}>
                {song.albumImageUrl ? (
                  <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
                ) : (
                  <span className={sharedStyles.emptyArtwork} />
                )}
              </span>
              <span>
                <strong>{song.title}</strong>
                <small>{song.author.nickname}</small>
              </span>
              <Asset name="post-more.svg" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

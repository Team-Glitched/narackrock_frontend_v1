import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { HomeWorkSection } from "@/features/workspace/home-work-section";
import { uiLabels } from "@/lib/ui-labels";
import { SectionTitle } from "@/components/section-title";
import { SongRail } from "@/features/home/song-rail";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { MiniPost, PostListStatus } from "@/features/posts/post-list";
import { useMySongs } from "./use-my-songs";
import { songsForTab, type MySongTab } from "./my-songs";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { PopularContentActions } from "@/features/posts/popular-content-actions";

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
          <SongRail songs={songs.popular.items} onOpen={onOpenShort} actions />
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
  kind, tab, onTabChange, onOpenShort,
}: {
  kind: SongChartKind;
  tab: MySongTab;
  onTabChange: (tab: MySongTab) => void;
  onOpenShort: (shortId: number) => void;
}) {
  return kind === "mine"
    ? <MySongsChart tab={tab} onTabChange={onTabChange} onOpenShort={onOpenShort} />
    : <RankedSongsChart kind={kind} onOpenShort={onOpenShort} />;
}

function MySongsChart({ tab, onTabChange, onOpenShort }: {
  tab: MySongTab;
  onTabChange: (tab: MySongTab) => void;
  onOpenShort: (shortId: number) => void;
}) {
  const userId = useCurrentUserId();
  const songs = useMySongs();
  const items = userId === null ? [] : songsForTab(songs.items, userId, tab);
  return (
    <div className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>{uiLabels.myMusic}</h1>
      <div className="mb-5 flex gap-3" role="group" aria-label="내 음악 종류">
        {(["authored", "participated"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={tab === value}
            className="rounded-lg border border-app-muted px-4 py-2 aria-pressed:bg-app-surface"
            onClick={() => onTabChange(value)}>
            {value === "authored" ? "내 작업물" : "내 참가작"}
          </button>
        ))}
      </div>
      {songs.status !== "ready" ? <SongRailStatus state={songs.status} /> : (
        <>
          <div className={sharedStyles.chartList}>
            {items.map((song) => (
              <button type="button" className={sharedStyles.chartRow} key={song.shortId}
                onClick={() => onOpenShort(song.shortId)}>
                <span className={sharedStyles.chartArt}>
                  {song.albumImageUrl ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} />
                    : <span className={sharedStyles.emptyArtwork} />}
                </span>
                <span><strong>{song.title}</strong><small>{song.author.nickname}</small></span>
              </button>
            ))}
          </div>
          {items.length === 0 && <p role="status">
            {songs.hasMore ? "아직 이 종류의 곡을 찾지 못했습니다. 다음 목록도 확인해 주세요."
              : tab === "authored" ? "아직 작성한 곡이 없습니다." : "아직 참가한 곡이 없습니다."}
          </p>}
        </>
      )}
      {songs.error && <p role="alert">{songs.error}</p>}
      {songs.status === "error" && <button onClick={songs.retry}>다시 시도</button>}
      {songs.status === "ready" && songs.hasMore && (
        <button className="my-5 min-h-11 w-full rounded-lg bg-app-surface px-4 py-2"
          disabled={songs.appending} onClick={songs.loadMore}>
          {songs.appending ? "불러오는 중..." : songs.error ? "다음 목록 다시 시도" : "더보기"}
        </button>
      )}
    </div>
  );
}

function RankedSongsChart({
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
            <div className={sharedStyles.chartRow} key={song.shortId}>
              <button type="button" className="flex min-w-0 flex-1 items-center text-left" onClick={() => onOpenShort(song.shortId)}>
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
              </button>
              {kind === "popular" && <PopularContentActions kind="short" id={song.shortId} title={song.title} ownerId={song.author.userId} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

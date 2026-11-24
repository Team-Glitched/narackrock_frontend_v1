import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { filterChip, filterChipRow } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { HomeWorkSection } from "@/features/workspace/home-work-section";
import { uiLabels } from "@/lib/ui-labels";
import { AlbumArtwork } from "@/components/music-card";
import { SectionTitle } from "@/components/section-title";
import { SongRail } from "@/features/home/song-rail";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useHomeSongs } from "@/features/home/use-home-songs";
import { MiniPost, PostListStatus } from "@/features/posts/post-list";
import { useMySongs } from "./use-my-songs";
import { songsForTab, type MySongTab } from "./my-songs";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { PopularContentActions } from "@/features/posts/popular-content-actions";
import { useQuery } from "@tanstack/react-query";
import { FeaturedStarButton } from "@/features/profile/featured-star-button";
import { useFeaturedMusic, type PinnedSongInput } from "@/features/profile/use-featured-music";
import { profileQuery } from "@/features/profile/profile-queries";
import type { UserProfile } from "@/lib/api/contracts";

export type MusicListTab = MySongTab | "featured";

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
  // Guests have no works or songs of their own, so their sections are not shown at all.
  const signedIn = useCurrentUserId() !== null;
  const featured = useFeaturedMusic(signedIn);
  return (
    <div className={cn(sharedStyles.homeContent, sharedStyles.scrollContent)}>
      {signedIn && (
        <HomeWorkSection onOpenWorkspace={onOpenWorkspace} onStartSong={onStartSong} onResume={onResume} />
      )}
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
        <SectionTitle onAll={() => onShowSongs("recommended")}>추천</SectionTitle>
        {songs.recommended.status !== "ready" ? (
          <SongRailStatus state={songs.recommended.status} />
        ) : songs.recommended.firstPage.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          <SongRail songs={songs.recommended.firstPage} onOpen={onOpenShort} actions />
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
      {signedIn && (
        <section>
          <SectionTitle onAll={() => onShowSongs("mine")}>{uiLabels.myMusic}</SectionTitle>
          {featured.notice && (
            <p
              role="alert"
              className="mx-5 mb-3 rounded-[12px] border border-solid border-app-border px-4 py-3 text-body leading-[20px] text-[#ff8d8d]"
            >
              {featured.notice}
            </p>
          )}
          {songs.mine.status !== "ready" ? (
            <SongRailStatus state={songs.mine.status} />
          ) : songs.mine.items.length === 0 ? (
            <SongRailStatus state="empty" />
          ) : (
            <SongRail
              songs={songs.mine.items}
              onOpen={onOpenShort}
              renderCorner={(song) => (
                <FeaturedStarButton
                  variant="card"
                  songTitle={song.title}
                  pinned={featured.pinnedIds.has(song.shortId)}
                  busy={!featured.profile.data || featured.savingId !== null}
                  onToggle={() => void featured.toggleFeatured(song)}
                />
              )}
            />
          )}
        </section>
      )}
    </div>
  );
}

export function ChartsScreen({
  kind, tab, onTabChange, onOpenShort, featuredUserId,
}: {
  kind: SongChartKind;
  tab: MusicListTab;
  onTabChange: (tab: MusicListTab) => void;
  onOpenShort: (shortId: number) => void;
  featuredUserId?: number;
}) {
  return kind === "mine"
    ? <MySongsChart tab={tab} onTabChange={onTabChange} onOpenShort={onOpenShort} featuredUserId={featuredUserId} />
    : <RankedSongsChart kind={kind} onOpenShort={onOpenShort} />;
}

/** State of the "내 음악" chart, shared by the web chart and the app's native chart. */
export function useMyMusic(tab: MusicListTab, featuredUserId?: number) {
  const userId = useCurrentUserId();
  const targetUserId = featuredUserId ?? userId;
  const otherFeatured = featuredUserId !== undefined && featuredUserId !== userId;
  const activeTab: MusicListTab = otherFeatured ? "featured" : tab;
  const canManageFeatured = userId !== null && targetUserId === userId;
  const targetProfile = useQuery({
    ...profileQuery(userId, targetUserId ?? 0),
    enabled: targetUserId !== null && otherFeatured,
  });
  const featured = useFeaturedMusic(canManageFeatured);
  const profile = canManageFeatured ? featured.profile : targetProfile;
  const songs = useMySongs(20, activeTab !== "featured");

  const pinnedShorts = profile.data?.activities.pinnedShorts ?? [];
  const pinnedIds = new Set(pinnedShorts.map((song) => song.shortId));
  const items = userId === null || activeTab === "featured" ? [] : songsForTab(songs.items, userId, activeTab);

  return {
    targetUserId,
    otherFeatured,
    activeTab,
    canManageFeatured,
    profile,
    songs,
    items,
    pinnedIds,
    pinnedCount: pinnedShorts.length,
    maxFeatured: featured.maxFeatured,
    savingId: featured.savingId,
    featureNotice: featured.notice,
    clearNotice: featured.clearNotice,
    toggleFeatured: featured.toggleFeatured,
  };
}

function MySongsChart({ tab, onTabChange, onOpenShort, featuredUserId }: {
  tab: MusicListTab;
  onTabChange: (tab: MusicListTab) => void;
  onOpenShort: (shortId: number) => void;
  featuredUserId?: number;
}) {
  const {
    targetUserId,
    otherFeatured,
    activeTab,
    canManageFeatured,
    profile,
    songs,
    items,
    pinnedIds,
    pinnedCount,
    maxFeatured,
    savingId,
    featureNotice,
    clearNotice,
    toggleFeatured,
  } = useMyMusic(tab, featuredUserId);

  return (
    <div className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>
        {otherFeatured ? uiLabels.featuredMusic : uiLabels.myMusic}
      </h1>
      {!otherFeatured && (
        <div className={cn(filterChipRow, "mb-4 px-5")} role="group" aria-label="내 음악 종류">
          {(["featured", "authored", "participated"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={activeTab === value}
              className={filterChip}
              onClick={() => {
                clearNotice();
                onTabChange(value);
              }}>
              {value === "authored" ? "내 작업물" : value === "participated" ? "내 참가작" : "대표 음악"}
            </button>
          ))}
        </div>
      )}
      {canManageFeatured && profile.data && (
        <p className="mb-4 px-5 text-caption leading-[18px] text-app-muted">
          별표를 눌러 대표 음악을 최대 {maxFeatured}개까지 설정할 수 있어요. ({pinnedCount}/{maxFeatured})
        </p>
      )}
      {featureNotice && (
        <p role="alert" className="mx-5 mb-4 rounded-[12px] border border-solid border-app-border px-4 py-3 text-body leading-[20px] text-[#ff8d8d]">
          {featureNotice}
        </p>
      )}
      {activeTab === "featured" ? (
        <FeaturedSongsChart
          key={targetUserId ?? "signed-out"}
          userId={targetUserId}
          profile={profile}
          canManageFeatured={canManageFeatured}
          savingId={savingId}
          onToggleFeatured={toggleFeatured}
          onOpenShort={onOpenShort}
        />
      ) : <>
      {songs.status !== "ready" ? <SongRailStatus state={songs.status} /> : (
        <>
          <div className={sharedStyles.chartList}>
            {items.map((song) => (
              <div className={cn(sharedStyles.chartRow, "gap-2")} key={song.shortId}>
                <button type="button" className="flex min-w-0 flex-1 items-center text-left" onClick={() => onOpenShort(song.shortId)}>
                  <AlbumArtwork
                    src={song.albumImageUrl}
                    title={song.title}
                    seed={`short:${song.shortId}`}
                    className={sharedStyles.chartArt}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                    <strong className="truncate">{song.title}</strong>
                    <small className="truncate">{song.author.nickname}</small>
                  </span>
                </button>
                {canManageFeatured && profile.data && (
                  <FeaturedStarButton
                    songTitle={song.title}
                    pinned={pinnedIds.has(song.shortId)}
                    busy={savingId !== null}
                    onToggle={() => void toggleFeatured(song)}
                  />
                )}
              </div>
            ))}
          </div>
          {items.length === 0 && <p role="status" className="px-5 py-10 text-center text-body leading-[20px] text-app-muted">
            {songs.hasMore ? "아직 이 종류의 곡을 찾지 못했습니다. 다음 목록도 확인해 주세요."
              : activeTab === "authored" ? "아직 작성한 곡이 없습니다." : "아직 참가한 곡이 없습니다."}
          </p>}
        </>
      )}
      {songs.error && <p role="alert" className="mx-5 mt-3 rounded-[12px] border border-solid border-app-border px-4 py-3 text-body leading-[20px] text-[#ff8d8d]">{songs.error}</p>}
      {songs.status === "error" && (
        <div className="mt-4 flex justify-center px-5">
          <button type="button" className="min-h-11 rounded-full bg-app-surface px-6 text-body font-medium" onClick={songs.retry}>
            다시 시도
          </button>
        </div>
      )}
      {songs.status === "ready" && songs.hasMore && (
        <div className="my-4 px-5">
          <button className="min-h-11 w-full rounded-lg bg-app-surface px-4 py-2 text-body font-medium"
            disabled={songs.appending} onClick={songs.loadMore}>
            {songs.appending ? "불러오는 중..." : songs.error ? "다음 목록 다시 시도" : "더보기"}
          </button>
        </div>
      )}
      </>}
    </div>
  );
}

function FeaturedSongsChart({
  userId,
  profile,
  canManageFeatured,
  savingId,
  onToggleFeatured,
  onOpenShort,
}: {
  userId: number | null;
  profile: {
    data?: UserProfile;
    isError: boolean;
    error: unknown;
    isPending: boolean;
    refetch: () => Promise<unknown>;
  };
  canManageFeatured: boolean;
  savingId: number | null;
  onToggleFeatured: (song: PinnedSongInput) => Promise<void>;
  onOpenShort: (shortId: number) => void;
}) {
  if (userId === null) return <SongRailStatus state="signed-out" />;
  if (profile.isError) {
    const message = profile.error instanceof Error ? profile.error.message : "대표 음악을 불러오지 못했습니다.";
    return (
      <div role="alert" className="mx-5 my-8 flex flex-col items-center justify-center gap-4 p-4 text-center text-body leading-[20px] text-[#ff8d8d]">
        <p className="m-0">{message}</p>
        <button className="rounded-full bg-app-surface px-5 py-2.5 text-body text-app-fg" onClick={() => void profile.refetch()}>
          다시 시도
        </button>
      </div>
    );
  }
  const profileData = profile.data;
  if (profile.isPending || !profileData) return <SongRailStatus state="loading" />;
  const sorted = [...profileData.activities.pinnedShorts].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <>
      <div className={sharedStyles.chartList}>
        {sorted.map((song) => (
          <div className={cn(sharedStyles.chartRow, "gap-2")} key={song.shortId}>
            <button type="button" className="flex min-w-0 flex-1 items-center text-left" onClick={() => onOpenShort(song.shortId)}>
              <AlbumArtwork
                src={song.albumImageUrl}
                title={song.title}
                seed={`short:${song.shortId}`}
                className={sharedStyles.chartArt}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                <strong className="truncate">{song.title}</strong>
                <small className="truncate">{profileData.nickname}</small>
              </span>
            </button>
            {canManageFeatured && (
              <FeaturedStarButton
                songTitle={song.title}
                pinned
                busy={savingId !== null}
                onToggle={() => void onToggleFeatured(song)}
              />
            )}
          </div>
        ))}
      </div>
      {sorted.length === 0 && (
        <p role="status" className="px-5 py-12 text-center text-body leading-[22px] text-app-muted">
          아직 등록한 대표 음악이 없습니다.
          {canManageFeatured && (
            <>
              <br />
              내 작업물이나 내 참가작에서 별표를 눌러 설정해 보세요.
            </>
          )}
        </p>
      )}
    </>
  );
}

function RankedSongsChart({
  kind,
  onOpenShort,
}: {
  kind: "popular" | "recommended";
  onOpenShort: (shortId: number) => void;
}) {
  const { popular, recommended } = useHomeSongs(100, kind);
  const selected = kind === "popular" ? popular : recommended;
  const loadMoreLabel = recommended.appending ? "불러오는 중..."
    : recommended.expired ? "추천 다시 불러오기"
    : recommended.appendFailed ? "다시 시도"
    : "더 보기";
  return (
    <div className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>
        {kind === "popular" ? "인기 차트" : "추천"}
      </h1>
      <div className={sharedStyles.chartList}>
        {selected.status !== "ready" ? (
          <SongRailStatus state={selected.status} />
        ) : selected.items.length === 0 ? (
          <SongRailStatus state="empty" />
        ) : (
          selected.items.map((song) => (
            <div className={cn(sharedStyles.chartRow, "gap-2")} key={song.shortId}>
              <button type="button" className="flex min-w-0 flex-1 items-center text-left" onClick={() => onOpenShort(song.shortId)}>
                <AlbumArtwork
                  src={song.albumImageUrl}
                  title={song.title}
                  seed={`short:${song.shortId}`}
                  className={sharedStyles.chartArt}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                  <strong className="truncate">{song.title}</strong>
                  <small className="truncate">{song.author.nickname}</small>
                </span>
              </button>
              <PopularContentActions kind="short" id={song.shortId} title={song.title} ownerId={song.author.userId} />
            </div>
          ))
        )}
      </div>
      {kind === "recommended" && recommended.status === "error" && (
        <div className="mt-4 px-5">
          <button type="button" className="min-h-11 w-full rounded-lg bg-app-surface" onClick={recommended.retry}>
            다시 시도
          </button>
        </div>
      )}
      {kind === "recommended" && recommended.hasMore && (
        <div className="my-4 px-5">
          {recommended.appendFailed && (
            <p role="status">{recommended.expired ? "추천 목록이 만료됐습니다." : "다음 곡을 불러오지 못했습니다."}</p>
          )}
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-app-surface"
            disabled={recommended.appending}
            onClick={recommended.loadMore}
          >
            {loadMoreLabel}
          </button>
        </div>
      )}
    </div>
  );
}

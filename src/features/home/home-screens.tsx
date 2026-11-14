import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { filterChip, filterChipRow } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
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
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateFeaturedMusic } from "@/lib/api/profile";
import { profileKeys, profileQuery } from "@/features/profile/profile-queries";
import type { UserProfile } from "@/lib/api/contracts";

type MusicListTab = MySongTab | "featured";

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
        <SectionTitle onAll={() => onShowSongs("recommended")}>추천 음악</SectionTitle>
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
          {songs.mine.status !== "ready" ? (
            <SongRailStatus state={songs.mine.status} />
          ) : songs.mine.items.length === 0 ? (
            <SongRailStatus state="empty" />
          ) : (
            <SongRail songs={songs.mine.items} onOpen={onOpenShort} />
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

type PinnedSongInput = {
  shortId: number;
  title: string;
  albumImageUrl: string | null;
  mediaUrl: string | null;
};

function FeaturedStarButton({
  songTitle,
  pinned,
  busy,
  onToggle,
}: {
  songTitle: string;
  pinned: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mt-1 ml-2 grid size-9 shrink-0 place-items-center self-start rounded-full p-2 transition-colors",
        "hover:bg-app-surface disabled:opacity-50",
        pinned ? "text-amber-400" : "text-app-muted",
      )}
      aria-pressed={pinned}
      aria-label={pinned ? `${songTitle} 대표 음악 해제` : `${songTitle} 대표 음악 설정`}
      disabled={busy}
      onClick={onToggle}
    >
      <Star size={18} strokeWidth={1.75} className={pinned ? "fill-amber-400" : undefined} aria-hidden="true" />
    </button>
  );
}

function MySongsChart({ tab, onTabChange, onOpenShort, featuredUserId }: {
  tab: MusicListTab;
  onTabChange: (tab: MusicListTab) => void;
  onOpenShort: (shortId: number) => void;
  featuredUserId?: number;
}) {
  const userId = useCurrentUserId();
  const targetUserId = featuredUserId ?? userId;
  const canManageFeatured = userId !== null && targetUserId === userId;
  const queryClient = useQueryClient();
  const profile = useQuery({
    ...profileQuery(userId, targetUserId ?? 0),
    enabled: targetUserId !== null,
  });
  const songs = useMySongs(20, tab !== "featured");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [featureNotice, setFeatureNotice] = useState<string | null>(null);

  const pinnedShorts = profile.data?.activities.pinnedShorts ?? [];
  const pinnedIds = new Set(pinnedShorts.map((song) => song.shortId));
  const items = userId === null || tab === "featured" ? [] : songsForTab(songs.items, userId, tab);

  async function toggleFeatured(song: PinnedSongInput) {
    if (!canManageFeatured || !profile.data || savingId !== null) return;
    const currentlyPinned = pinnedIds.has(song.shortId);
    setSavingId(song.shortId);
    setFeatureNotice(null);
    try {
      await updateFeaturedMusic(currentlyPinned ? null : song.shortId);
      queryClient.setQueryData<UserProfile | undefined>(
        profileKeys.detail(userId, userId),
        (prev) => {
          if (!prev) return prev;
          const nextPinned = currentlyPinned ? [] : [{ ...song, displayOrder: 0 }];
          return {
            ...prev,
            activities: {
              ...prev.activities,
              pinnedShorts: nextPinned,
            },
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId, userId) });
    } catch (cause) {
      setFeatureNotice(cause instanceof Error ? cause.message : "대표 음악을 변경하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>{uiLabels.myMusic}</h1>
      <div className={cn(filterChipRow, "mb-4 px-5")} role="group" aria-label="내 음악 종류">
        {(["featured", "authored", "participated"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={tab === value}
            className={filterChip}
            onClick={() => {
              setFeatureNotice(null);
              onTabChange(value);
            }}>
            {value === "authored" ? "내 작업물" : value === "participated" ? "내 참가작" : "대표 음악"}
          </button>
        ))}
      </div>
      {canManageFeatured && profile.data && (
        <p className="mb-4 px-5 text-caption leading-[18px] text-app-muted">
          내 작업물의 완성곡 중 한 곡을 대표 음악으로 설정할 수 있어요.
        </p>
      )}
      {featureNotice && (
        <p role="alert" className="mx-5 mb-4 rounded-[12px] border border-solid border-app-border px-4 py-3 text-body leading-[20px] text-[#ff8d8d]">
          {featureNotice}
        </p>
      )}
      {tab === "featured" ? (
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
                  <AlbumArtwork src={song.albumImageUrl} title={song.title} className={sharedStyles.chartArt} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                    <strong className="truncate">{song.title}</strong>
                    <small className="truncate">{song.author.nickname}</small>
                  </span>
                </button>
                {canManageFeatured && profile.data && (pinnedIds.has(song.shortId) || (tab === "authored" && song.completionStatus === "COMPLETED")) && (
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
              : tab === "authored" ? "아직 작성한 곡이 없습니다." : "아직 참가한 곡이 없습니다."}
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
              <AlbumArtwork src={song.albumImageUrl} title={song.title} className={sharedStyles.chartArt} />
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
              내 작업물에서 완성곡의 별표를 눌러 설정해 보세요.
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
        {kind === "popular" ? "인기 차트" : "추천 음악"}
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
                <AlbumArtwork src={song.albumImageUrl} title={song.title} className={sharedStyles.chartArt} />
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

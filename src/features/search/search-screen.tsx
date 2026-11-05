import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { MiniPost } from "@/features/posts/post-list";
import { CommunityCard, galleryToCommunity, type Community } from "../community/community-card";
import { fetchGalleries, fetchPosts } from "@/lib/api/community";
import { searchPeople, type SearchedPerson } from "@/lib/api/social";
import { usePagedItems } from "@/hooks/use-paged-items";
import { searchShorts } from "@/lib/api/shorts";
import type { GalleryListItem, PostListItem, ShortItemDto } from "@/lib/api/contracts";
import { listOpenSources, type OpenSourceSummary } from "@/lib/api/open-sources";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { sourceError } from "@/features/sources/source-screens";
import type { SearchScope } from "@/features/search/search-scope";
import { searchCommunityPosts } from "@/features/community/post-search";
const scopes: { id: SearchScope; label: string }[] = [
  { id: "sources", label: "오픈소스" },
  { id: "songs", label: "음악" },
  { id: "people", label: "사용자" },
  { id: "posts", label: "게시글" },
  { id: "communities", label: "커뮤니티" },
];
type Results = {
  posts: PostListItem[];
  communities: GalleryListItem[];
  songs: ShortItemDto[];
  people: SearchedPerson[];
  sources: OpenSourceSummary[];
};
const empty = (): Results => ({ posts: [], communities: [], songs: [], people: [], sources: [] });
export function ScopedSearch({
  scope: requestedScope,
  community,
  onScope,
  query,
  onQuery,
  onBack,
  onPost,
  onCommunity,
  onSong,
  onSource,
  onProfile,
}: {
  community?: Pick<Community, "galleryId" | "name"> | null;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  query: string;
  onQuery: (value: string) => void;
  onBack: () => void;
  onPost: (id: number) => void;
  onCommunity: (community: Community) => void;
  onSong: (id: number) => void;
  onSource: (id: number) => void;
  onProfile: (id: number) => void;
}) {
  const [retry, setRetry] = useState(0);
  // Keep the native input stable while React Router commits query replacements.
  const [searchText, setSearchText] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (syncedQuery !== query) {
    setSyncedQuery(query);
    setSearchText(query);
  }
  const commitQuery = useEffectEvent(onQuery);
  useEffect(() => {
    if (searchText === query) return;
    const timer = window.setTimeout(() => commitQuery(searchText), 150);
    return () => window.clearTimeout(timer);
  }, [searchText, query]);
  const scope = community ? "posts" : requestedScope;
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryId = community?.galleryId;
  const userId = useCurrentUserId();
  const peopleSignInRequired = scope === "people" && userId === null;
  const key = `${userId}:${galleryId ?? "all"}:${scope}:${query.trim()}:${retry}`;
  const [loaded, setLoaded] = useState<{ key: string; results: Results; error?: string; pending?: boolean } | null>(
    null,
  );
  const keyword = query.trim();
  const [debouncedKey, setDebouncedKey] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKey(key), 200);
    return () => window.clearTimeout(timer);
  }, [key]);
  const paged = !community && (scope === "people" || scope === "songs");
  const loadPeople = useCallback(async (page: number, signal: AbortSignal) => {
    const size = 20;
    const result = await searchPeople(keyword, page, size, signal);
    return {
      items: result.users,
      next: result.users.length && (page + 1) * size < result.totalResultCount ? page + 1 : null,
    };
  }, [keyword]);
  const loadSongs = useCallback(async (cursor: number, signal: AbortSignal) => {
    const result = await searchShorts(keyword, cursor === 0 ? undefined : cursor, signal);
    return {
      items: result.items,
      next: result.page.hasMore ? result.page.nextCursor : null,
    };
  }, [keyword]);
  const people = usePagedItems(key, 0, loadPeople, paged && scope === "people" && !peopleSignInRequired && !!keyword && key === debouncedKey);
  const songs = usePagedItems(key, 0, loadSongs, paged && scope === "songs" && !!keyword && key === debouncedKey);
  const pagination = scope === "people" ? people : songs;

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword || paged) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const results = empty();
      void (async () => {
        const fetchForGallery: typeof fetchPosts = (id, options) =>
          fetchPosts(id, options, controller.signal);
        const matches = (value: string) =>
          value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
        if (galleryId !== undefined)
          results.posts = await searchCommunityPosts(fetchForGallery, galleryId, keyword);
        else if (scope === "communities")
          results.communities = (await fetchGalleries(controller.signal)).filter((item) =>
            matches(`${item.name} ${item.description ?? ""}`),
          );
        else if (scope === "posts") {
          const galleries = await fetchGalleries(controller.signal);
          const posts = new Map<number, PostListItem>();
          let failed = false;
          for (let offset = 0; active && offset < galleries.length; offset += 4) {
            const pages = await Promise.allSettled(galleries.slice(offset, offset + 4).map((gallery) =>
              searchCommunityPosts(fetchForGallery, gallery.galleryId, keyword),
            ));
            if (!active) return;
            for (const page of pages) {
              if (page.status === "rejected") failed = true;
              else for (const post of page.value) posts.set(post.postId, post);
            }
            if (posts.size && offset + 4 < galleries.length) {
              setLoaded({ key, results: { ...results, posts: [...posts.values()] }, pending: true });
            }
          }
          results.posts = [...posts.values()];
          if (failed) {
            setLoaded({ key, results, error: "일부 커뮤니티에서 검색하지 못했습니다." });
            return;
          }
        } else {
          if (userId === null) throw new Error("오픈소스 검색은 로그인 후 사용할 수 있습니다.");
          for (let page = 0; ; page++) {
            const result = await listOpenSources({ keyword, page }, controller.signal).catch((cause) => {
              throw new Error(sourceError(cause, "오픈소스를 검색하지 못했습니다."));
            });
            results.sources.push(...result.items);
            if (!result.hasNext) break;
          }
        }
        if (active) setLoaded({ key, results });
      })().catch((cause) => {
        if (active)
          setLoaded({
            key,
            results: empty(),
            error: cause instanceof Error ? cause.message : "검색에 실패했습니다.",
          });
      });
    }, 200);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [scope, query, key, galleryId, userId, paged]);
  const current = loaded?.key === key && !paged ? loaded : null;
  const results = paged
    ? pagination.state && { ...empty(), people: people.state?.items ?? [], songs: songs.state?.items ?? [] }
    : current?.results ?? null;
  return (
    <div className={cn(socialStyles.searchView, sharedStyles.scopedSearch)}>
      <div className={socialStyles.searchLine}>
        <button onClick={onBack} aria-label="돌아가기" title="돌아가기">
          <Asset name="search-back.svg" />
        </button>
        <label>
          <Asset name="search-input.svg" />
          <input
            ref={inputRef}
            autoFocus
            aria-label={
              community
                ? `${community.name} 내부 게시글 검색`
                : `${scopes.find((item) => item.id === scope)?.label} 검색`
            }
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={community ? "커뮤니티 내 게시글 검색" : "검색"}
          />
          <button
            onClick={() => {
              setSearchText("");
              onQuery("");
              inputRef.current?.focus();
            }}
            aria-label="검색어 지우기"
          >
            <Asset name="search-close.svg" />
          </button>
        </label>
      </div>
      {community && (
        <p className={communityStyles.communitySearchContext}>{community.name} 내 게시글</p>
      )}
      {!community && query.trim() && (
        <div className={socialStyles.searchScopeTabs} role="tablist" aria-label="검색 종류">
          {scopes.map((item) => (
            <button
              role="tab"
              key={item.id}
              aria-selected={scope === item.id}
              className={scope === item.id ? sharedStyles.active : ""}
              onClick={() => onScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(sharedStyles.scopedSearchResults, sharedStyles.scrollContent)}
        role="tabpanel"
        aria-label={
          community
            ? `${community.name} 내부 검색 결과`
            : `${scopes.find((item) => item.id === scope)?.label} 검색 결과`
        }
      >
        {peopleSignInRequired && (
          <SignInRequired>사용자 검색은 로그인 후 사용할 수 있습니다.</SignInRequired>
        )}
        {!peopleSignInRequired && query.trim() && (!results || current?.pending) && <p role="status">검색 중...</p>}
        {current?.error && (
          <div role="alert">
            <p>{current.error}</p>
            <button
              className={buttonVariants({
                tone: "secondary",
                size: "compact",
              })}
              onClick={() => setRetry((value) => value + 1)}
            >
              다시 시도
            </button>
          </div>
        )}
        {results &&
          Object.values(results).every((items) => items.length === 0) &&
          !current?.error && !current?.pending && !pagination.state?.error && pagination.state?.next == null && <p className={socialStyles.searchResult}>검색 결과가 없습니다.</p>}
        {scope === "posts" &&
          results?.posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={onPost} />)}
        {scope === "communities" && (
          <ul className={communityStyles.communityCardList}>
            {results?.communities.map((gallery) => (
              <CommunityCard
                key={gallery.galleryId}
                community={galleryToCommunity(gallery)}
                onOpen={onCommunity}
              />
            ))}
          </ul>
        )}
        {scope === "songs" &&
          results?.songs.map((song) => (
            <button
              className={sharedStyles.chartRow}
              key={song.shortId}
              onClick={() => onSong(song.shortId)}
            >
              <span className={sharedStyles.chartArt}>
                {song.albumImageUrl ? (
                  <AssetImage url={song.albumImageUrl} />
                ) : (
                  <span className={sharedStyles.emptyArtwork} />
                )}
              </span>
              <span>
                <strong>{song.title}</strong>
                <small>{song.author.nickname}</small>
              </span>
            </button>
          ))}
        {scope === "sources" &&
          results?.sources.map((source) => (
            <button
              className={sharedStyles.chartRow}
              key={source.openSourceId}
              onClick={() => onSource(source.openSourceId)}
            >
              <span className={sharedStyles.chartArt}>
                {source.thumbnailUrl ? (
                  <AssetImage url={source.thumbnailUrl} />
                ) : (
                  <span className={sharedStyles.emptyArtwork} />
                )}
              </span>
              <span>
                <strong>{source.title}</strong>
                <small>{source.writer.nickname}</small>
              </span>
            </button>
          ))}
        {scope === "people" &&
          results?.people.map((person) => (
            <button
              className={cn(socialStyles.personLink, socialStyles.searchPerson)}
              key={person.userId}
              onClick={() => onProfile(person.userId)}
            >
              <Avatar src={person.profileImageUrl} />
              <strong>{person.nickname}</strong>
            </button>
          ))}
        {paged && pagination.state?.error && <p role="alert">검색 결과를 불러오지 못했습니다.</p>}
        {paged && pagination.state && pagination.state.next !== null && (
          <button type="button" className={buttonVariants({ tone: "secondary", size: "compact" })}
            disabled={pagination.state.busy} onClick={pagination.more}>
            {pagination.state.busy ? "검색 중..." : pagination.state.error ? "다시 시도" : "더보기"}
          </button>
        )}
      </div>
    </div>
  );
}
function AssetImage({ url }: { url: string }) {
  return <img src={url} alt="앨범 커버" />;
}

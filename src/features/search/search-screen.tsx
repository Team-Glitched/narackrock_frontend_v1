import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { experimental_streamedQuery as streamedQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { AlbumArtwork } from "@/components/music-card";
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
import { queryScope } from "@/lib/query";
// `hint` tells first-time searchers what each tab looks for before anything is typed.
const scopes: { id: SearchScope; label: string; hint: string }[] = [
  { id: "sources", label: "샘플", hint: "샘플 제목이나 설명으로 검색해 보세요." },
  { id: "songs", label: "음악", hint: "곡 제목으로 음악을 검색해 보세요." },
  { id: "people", label: "사용자", hint: "닉네임으로 사용자를 검색해 보세요." },
  { id: "posts", label: "게시글", hint: "제목이나 내용으로 게시글을 검색해 보세요." },
  { id: "communities", label: "커뮤니티", hint: "이름이나 소개로 커뮤니티를 검색해 보세요." },
];
type Results = {
  posts: PostListItem[];
  communities: GalleryListItem[];
  songs: ShortItemDto[];
  people: SearchedPerson[];
  sources: OpenSourceSummary[];
};
const empty = (): Results => ({ posts: [], communities: [], songs: [], people: [], sources: [] });
type Loaded = { results: Results; error?: string; pending?: boolean };

/** Unpaged search of one scope. Posts found so far are yielded while further communities are still searched. */
async function* searchResults(
  scope: SearchScope,
  keyword: string,
  galleryId: number | undefined,
  signal: AbortSignal,
): AsyncGenerator<Loaded> {
  const results = empty();
  const fetchForGallery: typeof fetchPosts = (id, options) => fetchPosts(id, options, signal);
  const matches = (value: string) => value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
  if (galleryId !== undefined) results.posts = await searchCommunityPosts(fetchForGallery, galleryId, keyword);
  else if (scope === "communities")
    results.communities = (await fetchGalleries(signal)).filter((item) => matches(`${item.name} ${item.description ?? ""}`));
  else if (scope === "posts") {
    const galleries = await fetchGalleries(signal);
    const posts = new Map<number, PostListItem>();
    let failed = false;
    for (let offset = 0; offset < galleries.length; offset += 4) {
      const pages = await Promise.allSettled(galleries.slice(offset, offset + 4).map((gallery) =>
        searchCommunityPosts(fetchForGallery, gallery.galleryId, keyword),
      ));
      signal.throwIfAborted();
      for (const page of pages) {
        if (page.status === "rejected") failed = true;
        else for (const post of page.value) posts.set(post.postId, post);
      }
      if (posts.size && offset + 4 < galleries.length) yield { results: { ...results, posts: [...posts.values()] }, pending: true };
    }
    results.posts = [...posts.values()];
    if (failed) {
      yield { results, error: "일부 커뮤니티에서 검색하지 못했습니다." };
      return;
    }
  } else {
    for (let page = 0; ; page++) {
      const result = await listOpenSources({ keyword, page }, signal);
      results.sources.push(...result.items);
      if (!result.hasNext) break;
    }
  }
  yield { results };
}

/**
 * Search results of one scope, shared by the web search screen and the app's native search.
 * Inside a community only its posts are searched.
 */
export function useScopedSearch(
  requestedScope: SearchScope,
  query: string,
  community: Pick<Community, "galleryId" | "name"> | null | undefined,
) {
  const scope = community ? "posts" : requestedScope;
  const galleryId = community?.galleryId;
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const peopleSignInRequired = scope === "people" && userId === null;
  const keyword = query.trim();
  const key = `${userId}:${galleryId ?? "all"}:${scope}:${keyword}`;
  const [debouncedKey, setDebouncedKey] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKey(key), 200);
    return () => window.clearTimeout(timer);
  }, [key]);
  const debounced = !!keyword && key === debouncedKey;
  const paged = !community && (scope === "people" || scope === "songs");
  const people = usePagedItems(["search", "people", keyword], 0, async (page: number, signal: AbortSignal) => {
    const size = 20;
    const result = await searchPeople(keyword, page, size, signal);
    return {
      items: result.users,
      next: result.users.length && (page + 1) * size < result.totalResultCount ? page + 1 : null,
    };
  }, paged && scope === "people" && !peopleSignInRequired && debounced);
  const songs = usePagedItems(["search", "songs", keyword], 0, async (cursor: number, signal: AbortSignal) => {
    const result = await searchShorts(keyword, cursor === 0 ? undefined : cursor, signal);
    return {
      items: result.items,
      next: result.page.hasMore ? result.page.nextCursor : null,
    };
  }, paged && scope === "songs" && debounced);
  const pagination = scope === "people" ? people : songs;

  const sourcesSignInRequired = !paged && scope === "sources" && userId === null;
  const searchKey = [...queryScope(userId), "search", galleryId ?? "all", scope, keyword] as const;
  const search = useQuery({
    queryKey: searchKey,
    queryFn: streamedQuery({
      streamFn: ({ signal }) => searchResults(scope, keyword, galleryId, signal),
      reducer: (_: Loaded, chunk: Loaded) => chunk,
      initialValue: { results: empty() },
      // A background refetch keeps the shown results until the new search completes.
      refetchMode: "replace",
    }),
    enabled: !paged && !sourcesSignInRequired && debounced,
  });
  const current: Loaded | null = paged || sourcesSignInRequired || !keyword
    ? null
    : search.error
        ? {
            results: empty(),
            error: scope === "sources"
              ? sourceError(search.error, "샘플을 검색하지 못했습니다.")
              : search.error.message || "검색에 실패했습니다.",
          }
        : search.data ?? null;
  const results = paged
    ? pagination.state && { ...empty(), people: people.state?.items ?? [], songs: songs.state?.items ?? [] }
    : current?.results ?? null;
  return {
    scope,
    keyword,
    peopleSignInRequired,
    sourcesSignInRequired,
    paged,
    pagination,
    current,
    results,
    /** Nothing was found and nothing is still loading. */
    empty:
      results !== null &&
      Object.values(results).every((items) => items.length === 0) &&
      !current?.error && !current?.pending && !pagination.state?.error && pagination.state?.next == null,
    retry: () => void queryClient.resetQueries({ queryKey: searchKey, exact: true }),
    hint: scopes.find((item) => item.id === scope)?.hint ?? "",
    label: scopes.find((item) => item.id === scope)?.label ?? "",
  };
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    scope,
    keyword,
    peopleSignInRequired,
    sourcesSignInRequired,
    paged,
    pagination,
    current,
    results,
    empty: noResults,
    retry,
  } = useScopedSearch(requestedScope, query, community);
  const signInRequired = peopleSignInRequired || sourcesSignInRequired;
  return (
    <div className={cn(socialStyles.searchView, sharedStyles.scopedSearch)}>
      <div className={socialStyles.searchLine}>
        <button onClick={onBack} aria-label="돌아가기" title="돌아가기">
          <Asset name="return.svg" />
        </button>
        <div className="search-field focus-within:ring-2 focus-within:ring-app-primary">
          <Asset name="search-input.svg" />
          <input
            ref={inputRef}
            className="focus-visible:outline-none!"
            autoFocus
            aria-label={
              community
                ? `${community.name} 내부 게시글 검색`
                : `${scopes.find((item) => item.id === scope)?.label} 검색`
            }
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={community ? "커뮤니티 내 게시글 검색" : `${scopes.find((item) => item.id === scope)?.label} 검색`}
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                onQuery("");
                inputRef.current?.focus();
              }}
              aria-label="검색어 지우기"
            >
              <Asset name="search-close.svg" />
            </button>
          )}
        </div>
      </div>
      {community && (
        <p className={communityStyles.communitySearchContext}>{community.name} 내 게시글</p>
      )}
      {!community && (
        <div className={communityStyles.communityTabs} role="tablist" aria-label="검색 종류">
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
        {sourcesSignInRequired && (
          <SignInRequired>샘플 검색은 로그인 후 사용할 수 있습니다.</SignInRequired>
        )}
        {!signInRequired && !community && !keyword && (
          <p className={socialStyles.searchResult}>{scopes.find((item) => item.id === scope)?.hint}</p>
        )}
        {!signInRequired && query.trim() && (!results || current?.pending) && <p role="status" className="py-6 text-center text-body leading-[20px] text-app-muted">검색 중...</p>}
        {current?.error && (
          <div role="alert" className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-body leading-[20px] text-[#ff8d8d]">
            <p className="m-0">{current.error}</p>
            <button
              className={buttonVariants({
                tone: "secondary",
                size: "compact",
              })}
              onClick={retry}
            >
              다시 시도
            </button>
          </div>
        )}
        {noResults && <p className={socialStyles.searchResult}>검색 결과가 없습니다.</p>}
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
              <AlbumArtwork src={song.albumImageUrl} title={song.title} className={sharedStyles.chartArt} />
              <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                <strong className="truncate">{song.title}</strong>
                <small className="truncate">{song.author.nickname}</small>
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
              <AlbumArtwork src={source.thumbnailUrl} title={source.title} className={sharedStyles.chartArt} />
              <span className="flex min-w-0 flex-1 flex-col gap-[var(--supporting-copy-gap)]">
                <strong className="truncate">{source.title}</strong>
                <small className="truncate">{source.writer.nickname}</small>
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
              <Avatar size="md" src={person.profileImageUrl} />
              <strong className="truncate text-label font-semibold leading-[22px]">{person.nickname}</strong>
            </button>
          ))}
        {paged && pagination.state?.error && <p role="alert" className="rounded-[12px] border border-solid border-app-border px-4 py-3 text-center text-body leading-[20px] text-[#ff8d8d]">검색 결과를 불러오지 못했습니다.</p>}
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

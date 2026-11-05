import { socialStyles } from "@/styles/social.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { MiniPost } from "@/features/posts/post-list";
import { CommunityCard, galleryToCommunity, type Community } from "../community/community-card";
import { fetchGalleries, fetchPosts } from "@/lib/api/community";
import { getShorts } from "@/lib/api/shorts";
import type { GalleryListItem, PostListItem, ShortItemDto } from "@/lib/api/contracts";
import { searchPeople, type SearchedPerson } from "@/lib/api/social";
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
  const [loaded, setLoaded] = useState<{ key: string; results: Results; error?: string } | null>(
    null,
  );
  useEffect(() => {
    const keyword = query.trim();
    if (!keyword || peopleSignInRequired) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        const results = empty();
        const matches = (value: string) =>
          value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
        if (galleryId !== undefined)
          results.posts = await searchCommunityPosts(fetchPosts, galleryId, keyword);
        else if (scope === "communities")
          results.communities = (await fetchGalleries()).filter((item) =>
            matches(`${item.name} ${item.description ?? ""}`),
          );
        else if (scope === "songs")
          results.songs = (await getShorts()).items.filter((item) =>
            matches(`${item.title} ${item.author.nickname}`),
          );
        else if (scope === "people") {
          const size = 20;
          const users = new Map<number, SearchedPerson>();
          for (let page = 0; ; page++) {
            const result = await searchPeople(keyword, page, size, controller.signal);
            if (!active) return;
            for (const person of result.users) users.set(person.userId, person);
            if (result.users.length === 0 || (page + 1) * size >= result.totalResultCount) break;
          }
          results.people = [...users.values()];
        } else if (scope === "posts") {
          const galleries = await fetchGalleries();
          const pages = await Promise.all(
            galleries.map((gallery) =>
              searchCommunityPosts(fetchPosts, gallery.galleryId, keyword),
            ),
          );
          results.posts = [...new Map(pages.flat().map((post) => [post.postId, post])).values()];
        } else {
          if (userId === null) throw new Error("오픈소스 검색은 로그인 후 사용할 수 있습니다.");
          for (let page = 0; ; page++) {
            const result = await listOpenSources({ keyword, page }).catch((cause) => {
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
  }, [scope, query, key, galleryId, userId, peopleSignInRequired]);
  const results = loaded?.key === key ? loaded.results : null;
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
        {peopleSignInRequired && <SignInRequired>사용자 검색은 로그인 후 사용할 수 있습니다.</SignInRequired>}
        {!peopleSignInRequired && query.trim() && !results && <p role="status">검색 중...</p>}
        {loaded?.key === key && loaded.error && (
          <div role="alert">
            <p>{loaded.error}</p>
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
          !loaded?.error && <p className={socialStyles.searchResult}>검색 결과가 없습니다.</p>}
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
      </div>
    </div>
  );
}
function AssetImage({ url }: { url: string }) {
  return <img src={url} alt="앨범 커버" />;
}

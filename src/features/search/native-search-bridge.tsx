import { useLoginPrompt } from "@/features/auth/login-prompt";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import {
  nativeSong,
  nativeSourceRow,
  useNativeCommunities,
  useNativePosts,
} from "@/features/navigation/native-models";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeSearch } from "@/lib/native-screens";
import type { SearchScope } from "./search-scope";
import { useScopedSearch } from "./search-screen";

/** In the app the search page (ScopedSearch) is drawn natively (native/screens/search.tsx). */
export function NativeSearchBridge({
  scope: requestedScope,
  query,
  community,
  onScope,
  onQuery,
  onBack,
  onPost,
  onCommunity,
  onSong,
  onSource,
  onProfile,
}: {
  scope: SearchScope;
  query: string;
  community: Pick<Community, "galleryId" | "name"> | null;
  onScope: (scope: SearchScope) => void;
  onQuery: (value: string) => void;
  onBack: () => void;
  onPost: (id: number) => void;
  onCommunity: (galleryId: number) => void;
  onSong: (id: number) => void;
  onSource: (id: number) => void;
  onProfile: (id: number) => void;
}) {
  const search = useScopedSearch(requestedScope, query, community);
  const communities = useNativeCommunities();
  const toNativePosts = useNativePosts();
  const { requestLogin } = useLoginPrompt();
  const { scope, keyword, results, current, pagination, paged } = search;
  const signInRequired = search.peopleSignInRequired || search.sourcesSignInRequired;

  const model: NativeSearch = {
    query,
    scope,
    community: community?.name ?? null,
    placeholder: community ? "커뮤니티 내 게시글 검색" : `${search.label} 검색`,
    message: search.peopleSignInRequired
      ? { text: "사용자 검색은 로그인 후 사용할 수 있습니다.", tone: "muted", retry: false, signIn: true }
      : search.sourcesSignInRequired
        ? { text: "샘플 검색은 로그인 후 사용할 수 있습니다.", tone: "muted", retry: false, signIn: true }
        : current?.error
          ? { text: current.error, tone: "error", retry: true, signIn: false }
          : !community && !keyword
            ? { text: search.hint, tone: "muted", retry: false, signIn: false }
            : null,
    searching: !signInRequired && keyword !== "" && (!results || current?.pending === true),
    results: results && {
      posts: toNativePosts(results.posts),
      communities: results.communities.map((gallery) => communities.card(galleryToCommunity(gallery))),
      songs: results.songs.map(nativeSong),
      sources: results.sources.map(nativeSourceRow),
      people: results.people.map((person) => ({
        userId: person.userId,
        nickname: person.nickname,
        profileImageUrl: person.profileImageUrl,
      })),
    },
    empty: search.empty,
    paging:
      paged && pagination.state && pagination.state.next !== null
        ? { busy: pagination.state.busy, failed: pagination.state.error !== null }
        : null,
  };

  return useNativeScreen("search", model, {
    header: null,
    onBack,
    onAction: (action) => {
      switch (action.type) {
        case "sign-in":
          return requestLogin();
        case "query":
          return onQuery(action.value);
        case "scope":
          return onScope(action.scope);
        case "retry":
          return search.retry();
        case "more":
          return pagination.more();
        case "open-post":
          return onPost(action.postId);
        case "open-community":
          return onCommunity(action.galleryId);
        case "toggle-join":
          return communities.toggle(action.galleryId);
        case "open-short":
          return onSong(action.shortId);
        case "open-source":
          return onSource(action.openSourceId);
        case "open-profile":
          return onProfile(action.userId);
      }
    },
  });
}

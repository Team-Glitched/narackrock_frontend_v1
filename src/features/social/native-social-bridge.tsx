import type { ReactNode } from "react";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useNativeDirectory } from "@/features/community/native-community-bridge";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { creationTarget } from "@/features/navigation/creation-target";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { relationError } from "@/features/profile/profile-relations";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import type { PostSort } from "@/lib/api/contracts";
import type { Person } from "@/lib/api/social";
import type {
  NativeFailure,
  NativeFollowRequests,
  NativeFriend,
  NativeFriends,
  NativeFriendsAction,
  NativeFriendsList,
  NativeFriendsListKind,
  NativeHeader,
  NativeMoreAction,
  NativeMutualFriends,
  NativeRecommendedPeople,
  NativeSocial,
  NativeSocialAction,
  NativeSocialTab,
} from "@/lib/native-screens";
import {
  friendsSignInMessage,
  MUTUAL_PREVIEW,
  REQUEST_PREVIEW,
  useFollowRequests,
  useMutualFriends,
} from "./friends-screen";
import { isFeedAction, useNativeFeed } from "./native-feed";
import { useRecommendedPeople } from "./recommended-people-list";

/** Navigation of the social tabs: the same targets as the web CommunityScreen on all three pages. */
type SocialNavigation = {
  onTabChange: (tab: NativeSocialTab) => void;
  onHome: () => void;
  onSearch: () => void;
  onProfile: (userId: number) => void;
  onChat: (userId: number) => void;
};

function useSocialNavigation(onSearch: () => void): SocialNavigation {
  const { to } = useUrlNavigation();
  return {
    onTabChange: (tab) =>
      to(tab === "posts" ? "/social" : tab === "community" ? "/communities" : "/friends"),
    onHome: () => to("/"),
    onSearch,
    onProfile: (id) => to(`/users/${id}`),
    onChat: (id) => to(`/chat?userId=${id}`),
  };
}

const hubHeader: NativeHeader = {
  left: "logo",
  actions: ["notifications", "chat", "search", "account"],
};

/** Shows a social tab natively; tab changes and the logo go to the page's navigation. */
function useSocialScreen(
  model: NativeSocial,
  nav: SocialNavigation,
  onAction: (action: NativeSocialAction | NativeMoreAction) => void,
): ReactNode {
  return useNativeScreen("social", model, {
    header: hubHeader,
    onSearch: nav.onSearch,
    onAction: (action) => {
      if (action.type === "tab") nav.onTabChange(action.tab);
      else if (action.type === "home") nav.onHome();
      else onAction(action);
    },
  });
}

/** In the app /social (the posts tab of CommunityScreen) is drawn natively. */
export function NativeSocialPostsBridge({
  sort,
  onSearch,
  onComments,
  onCreate,
}: {
  sort: PostSort;
  onSearch: () => void;
  onComments: (postId: number) => void;
  onCreate: () => void;
}) {
  const nav = useSocialNavigation(onSearch);
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID, { sort });
  const { role } = useGalleryRole(DEFAULT_GALLERY_ID);
  const { feed, handle, sources } = useNativeFeed({
    posts,
    moderation: { galleryId: DEFAULT_GALLERY_ID, canManage: Boolean(role?.canManage) },
    texts: {
      loadingText: "게시글을 불러오는 중...",
      errorText: "게시글을 불러오지 못했습니다.",
      emptyText: "아직 게시글이 없어요.",
    },
    autoMore: false,
    endNotice: false,
    onComments,
    onProfile: nav.onProfile,
  });
  const model: NativeSocial = {
    tab: "posts",
    posts: feed,
    communities: null,
    friends: null,
    create: { label: "글쓰기", accessibilityLabel: "글쓰기" },
  };
  const node = useSocialScreen(model, nav, (action) => {
    if (action.type === "create") onCreate();
    else if (action.type === "more") posts.loadMore();
    else if (isFeedAction(action)) handle(action);
  });
  return (
    <>
      {sources}
      {node}
    </>
  );
}

/** In the app /communities (the community tab of CommunityScreen) is drawn natively. */
export function NativeSocialCommunitiesBridge({ onSearch }: { onSearch: () => void }) {
  const nav = useSocialNavigation(onSearch);
  const { to } = useUrlNavigation();
  const target = creationTarget("communities");
  const { directory, handle } = useNativeDirectory({
    onOpen: (galleryId) => to(`/communities/${galleryId}`),
    onJoined: () => to("/communities/joined"),
  });
  const model: NativeSocial = {
    tab: "community",
    posts: null,
    communities: directory,
    friends: null,
    create: { label: "만들기", accessibilityLabel: `만들기: ${target.label}` },
  };
  return useSocialScreen(model, nav, (action) => {
    switch (action.type) {
      case "create":
        return to(target.path);
      case "open-community":
      case "toggle-join":
      case "open-joined":
      case "directory-retry":
        return handle(action);
    }
  });
}

function friend(
  person: Pick<Person, "nickname" | "profileImageUrl" | "primaryInstrument"> & { userId: number },
): NativeFriend {
  return {
    userId: person.userId,
    nickname: person.nickname,
    profileImageUrl: person.profileImageUrl,
    instrument: person.primaryInstrument ?? "",
  };
}

function queryFailure(
  query: { isError: boolean; error: unknown; isFetching: boolean },
  fallback: string,
): NativeFailure | null {
  return query.isError
    ? {
        message: relationError(query.error, fallback),
        retryLabel: "다시 시도",
        retryDisabled: query.isFetching,
      }
    : null;
}

type MutualSection = { model: NativeMutualFriends; retry: () => void };
type RequestsSection = {
  model: NativeFollowRequests;
  retry: () => void;
  decide: (requestId: number, decision: "accept" | "reject") => void;
};
type RecommendationsSection = {
  model: NativeRecommendedPeople;
  follow: (userId: number) => void;
  retry: () => void;
  retryOutgoing: () => void;
  more: () => void;
};

/** 맞팔로우 (MutualFriends) as a native model; `full` is the list page. */
function useNativeMutual(userId: number, full: boolean): MutualSection {
  const { query, people } = useMutualFriends(userId);
  return {
    model: {
      loading: query.isPending ? "맞팔로우를 불러오는 중..." : null,
      failure: queryFailure(query, "맞팔로우를 불러오지 못했습니다."),
      empty: query.isSuccess && people.length === 0 ? "아직 맞팔로우한 친구가 없습니다." : null,
      people: (full ? people : people.slice(0, MUTUAL_PREVIEW)).map(friend),
    },
    retry: () => void query.refetch(),
  };
}

/** 팔로우 요청 (FollowRequests) as a native model; `full` is the list page. */
function useNativeRequests(userId: number, full: boolean): RequestsSection {
  const { query, requests, notice, busy, decide } = useFollowRequests(userId);
  return {
    model: {
      notice: notice || null,
      busy,
      loading: query.isPending ? "팔로우 요청을 불러오는 중..." : null,
      failure: queryFailure(query, "팔로우 요청을 확인하지 못했습니다."),
      empty: query.isSuccess && requests.length === 0 ? "받은 팔로우 요청이 없습니다." : null,
      requests: (full ? requests : requests.slice(0, REQUEST_PREVIEW)).map((request) => ({
        requestId: request.requestId,
        person: friend({ ...request, userId: request.requesterId }),
      })),
    },
    retry: () => void query.refetch(),
    decide,
  };
}

/** 팔로우 추천 (RecommendedPeopleList) as a native model; `full` is the list page. */
function useNativeRecommendations(full: boolean): RecommendationsSection {
  const recommended = useRecommendedPeople(full);
  const { loaded, loading, syncing, stale, error, checking, outgoingError, busy, notice } =
    recommended;
  const { people, visible, hasMore, followButton } = recommended;
  return {
    model: {
      checking: checking ? "보낸 팔로우 요청 확인 중..." : null,
      outgoingFailure: outgoingError
        ? {
            message: `확인 실패: ${outgoingError}`,
            retryLabel: "다시 확인",
            retryDisabled: checking,
          }
        : null,
      failure: error
        ? {
            message: error,
            stale,
            retryLabel: stale ? "다시 동기화" : "다시 시도",
            retryDisabled: loading || syncing || busy,
          }
        : null,
      notice: notice || null,
      loading:
        loading || syncing ? (syncing ? "추천 목록 동기화 중..." : "추천을 불러오는 중...") : null,
      empty:
        !loading && !error && loaded && people.length === 0 ? "추천할 사용자가 없습니다." : null,
      people: visible.map((person) => {
        const button = followButton(person);
        return {
          person: friend(person),
          label: button.label,
          accessibilityLabel: button.accessibilityLabel,
          pressed: button.known ? button.state !== null : null,
          tone: button.state ? "secondary" : "primary",
          disabled: button.disabled,
        };
      }),
      more: full && hasMore ? { disabled: loading || syncing || stale || busy } : null,
    },
    follow: (userId) => {
      const person = visible.find((item) => item.userId === userId);
      if (person) recommended.change(person.userId, followButton(person).state);
    },
    retry: recommended.retry,
    retryOutgoing: recommended.refetchOutgoing,
    more: recommended.more,
  };
}

type FriendsHandlers = {
  mutual?: MutualSection;
  requests?: RequestsSection;
  recommendations?: RecommendationsSection;
  onProfile: (userId: number) => void;
  onChat: (userId: number) => void;
  onOpenList?: (kind: NativeFriendsListKind) => void;
  requestLogin: () => void;
};

/** Performs a friends action with the sections shown on the page. */
function handleFriends(action: NativeFriendsAction | NativeMoreAction, on: FriendsHandlers) {
  switch (action.type) {
    case "sign-in":
      return on.requestLogin();
    case "open-profile":
      return on.onProfile(action.userId);
    case "open-chat":
      return on.onChat(action.userId);
    case "open-friends-list":
      return on.onOpenList?.(action.kind);
    case "mutual-retry":
      return on.mutual?.retry();
    case "requests-retry":
      return on.requests?.retry();
    case "review-request":
      return on.requests?.decide(action.requestId, action.decision);
    case "outgoing-retry":
      return on.recommendations?.retryOutgoing();
    case "recommendations-retry":
      return on.recommendations?.retry();
    case "follow":
      return on.recommendations?.follow(action.userId);
    case "more":
      return on.recommendations?.more();
  }
}

const friendsActions: Record<NativeFriendsAction["type"], true> = {
  "sign-in": true,
  "open-profile": true,
  "open-chat": true,
  "open-friends-list": true,
  "mutual-retry": true,
  "requests-retry": true,
  "outgoing-retry": true,
  "recommendations-retry": true,
  "review-request": true,
  follow: true,
};

function isFriendsAction(action: { type: string }): action is NativeFriendsAction {
  return Object.hasOwn(friendsActions, action.type);
}

/** In the app /friends (the friends tab of CommunityScreen) is drawn natively. */
export function NativeSocialFriendsBridge({ onSearch }: { onSearch: () => void }) {
  const userId = useCurrentUserId();
  return userId === null ? (
    <SignedOutFriendsBridge onSearch={onSearch} />
  ) : (
    <SignedInFriendsBridge key={userId} userId={userId} onSearch={onSearch} />
  );
}

function SignedOutFriendsBridge({ onSearch }: { onSearch: () => void }) {
  const nav = useSocialNavigation(onSearch);
  const { to } = useUrlNavigation();
  const { requestLogin } = useLoginPrompt();
  const friends: NativeFriends = { signedIn: false, message: friendsSignInMessage };
  const model: NativeSocial = {
    tab: "friends",
    posts: null,
    communities: null,
    friends,
    create: { label: "친구 찾기", accessibilityLabel: "친구 찾기" },
  };
  return useSocialScreen(model, nav, (action) => {
    if (action.type === "create") to(creationTarget("people").path);
    else if (action.type === "sign-in") requestLogin();
  });
}

function SignedInFriendsBridge({ userId, onSearch }: { userId: number; onSearch: () => void }) {
  const nav = useSocialNavigation(onSearch);
  const { to } = useUrlNavigation();
  const { requestLogin } = useLoginPrompt();
  const mutual = useNativeMutual(userId, false);
  const recommendations = useNativeRecommendations(false);
  const requests = useNativeRequests(userId, false);
  const friends: NativeFriends = {
    signedIn: true,
    mutual: mutual.model,
    recommendations: recommendations.model,
    requests: requests.model,
  };
  const model: NativeSocial = {
    tab: "friends",
    posts: null,
    communities: null,
    friends,
    create: { label: "친구 찾기", accessibilityLabel: "친구 찾기" },
  };
  return useSocialScreen(model, nav, (action) => {
    if (action.type === "create") return to(creationTarget("people").path);
    if (isFriendsAction(action))
      handleFriends(action, {
        mutual,
        requests,
        recommendations,
        onProfile: nav.onProfile,
        onChat: nav.onChat,
        onOpenList: (kind) => to(`/friends/${kind}`),
        requestLogin,
      });
  });
}

type FriendsListProps = {
  kind: NativeFriendsListKind;
  onBack: () => void;
  onSearch: () => void;
};

const listHeader: NativeHeader = { left: "back", actions: ["notifications", "search", "account"] };

/** In the app /friends/:list (FriendsListScreen) is drawn natively; only that list's data is loaded. */
export function NativeFriendsListBridge(props: FriendsListProps) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignedOutFriendsListBridge {...props} />;
  const key = `${userId}:${props.kind}`;
  return props.kind === "mutual" ? (
    <MutualListBridge key={key} userId={userId} {...props} />
  ) : props.kind === "requests" ? (
    <RequestsListBridge key={key} userId={userId} {...props} />
  ) : (
    <RecommendationsListBridge key={key} {...props} />
  );
}

function useFriendsListScreen(
  model: NativeFriendsList,
  props: FriendsListProps,
  sections: Pick<FriendsHandlers, "mutual" | "requests" | "recommendations">,
) {
  const { requestLogin } = useLoginPrompt();
  const { to } = useUrlNavigation();
  return useNativeScreen("social-friends-list", model, {
    header: listHeader,
    onBack: props.onBack,
    onSearch: props.onSearch,
    onAction: (action) =>
      handleFriends(action, {
        ...sections,
        onProfile: (id) => to(`/users/${id}`),
        onChat: (id) => to(`/chat?userId=${id}`),
        requestLogin,
      }),
  });
}

function SignedOutFriendsListBridge(props: FriendsListProps) {
  const model: NativeFriendsList = {
    kind: props.kind,
    signedIn: false,
    message: friendsSignInMessage,
  };
  return useFriendsListScreen(model, props, {});
}

function MutualListBridge({ userId, ...props }: FriendsListProps & { userId: number }) {
  const mutual = useNativeMutual(userId, true);
  return useFriendsListScreen({ signedIn: true, kind: "mutual", mutual: mutual.model }, props, {
    mutual,
  });
}

function RequestsListBridge({ userId, ...props }: FriendsListProps & { userId: number }) {
  const requests = useNativeRequests(userId, true);
  return useFriendsListScreen(
    { signedIn: true, kind: "requests", requests: requests.model },
    props,
    {
      requests,
    },
  );
}

function RecommendationsListBridge(props: FriendsListProps) {
  const recommendations = useNativeRecommendations(true);
  return useFriendsListScreen(
    { signedIn: true, kind: "recommendations", recommendations: recommendations.model },
    props,
    { recommendations },
  );
}

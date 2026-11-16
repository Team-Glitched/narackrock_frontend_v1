import { useMemo } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import {
  joinedListView,
  membershipChangeError,
  recommendedView,
  useCommunityDirectory,
} from "@/features/community/community-directory";
import { useCommunityMembership } from "@/features/community/community-membership";
import { useGalleries } from "@/features/community/use-galleries";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { useNativeCommunities } from "@/features/navigation/native-models";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { useNativeFeed } from "@/features/social/native-feed";
import type { PostSort } from "@/lib/api/contracts";
import type {
  NativeCommunityDetail,
  NativeCommunityList,
  NativeDirectoryAction,
  NativeHeader,
  NativeJoinedCommunities,
  NativePageState,
} from "@/lib/native-screens";

const backHeader: NativeHeader = { left: "back", actions: ["notifications", "search", "account"] };

/**
 * The web community directory (CommunityDirectory / JoinedCommunitiesScreen) as native lists: the same
 * sections, rows and join controls. `handle` performs the directory actions.
 */
export function useNativeDirectory({
  onOpen,
  onJoined,
}: {
  onOpen: (galleryId: number) => void;
  onJoined?: () => void;
}) {
  const userId = useCurrentUserId();
  const state = useCommunityDirectory();
  const membership = useCommunityMembership();
  const communities = useNativeCommunities();

  function list(
    view: "loading" | "failed" | "empty" | "list",
    items: Community[],
    emptyText: string,
  ): NativeCommunityList {
    return {
      status: view === "list" ? "ready" : view,
      failure:
        view === "failed"
          ? { message: state.failureMessage, retryLabel: "다시 시도", retryDisabled: false }
          : null,
      emptyText,
      items: view === "list" ? items.map(communities.card) : [],
    };
  }

  function handle(action: NativeDirectoryAction) {
    switch (action.type) {
      case "open-community":
        return onOpen(action.galleryId);
      case "toggle-join":
        return communities.toggle(action.galleryId);
      case "open-joined":
        return onJoined?.();
      case "directory-retry":
        return state.retry();
    }
  }

  const recommended = recommendedView(state, userId !== null);
  return {
    directory: {
      joined:
        userId === null
          ? null
          : list(joinedListView(state), state.joined.slice(0, 4), "아직 가입한 커뮤니티가 없어요."),
      recommended:
        recommended === null
          ? null
          : list(recommended, state.recommended, "가입하지 않은 커뮤니티가 없어요."),
      membershipError: membershipChangeError(membership),
    },
    /** Every joined community (the full list page). */
    allJoined: list(joinedListView(state), state.joined, "아직 가입한 커뮤니티가 없어요."),
    handle,
  };
}

/** In the app /communities/joined (JoinedCommunitiesScreen) is drawn natively. */
export function NativeJoinedBridge({
  onOpen,
  onBack,
  onSearch,
}: {
  onOpen: (galleryId: number) => void;
  onBack: () => void;
  onSearch: () => void;
}) {
  const { directory, allJoined, handle } = useNativeDirectory({ onOpen });
  const model: NativeJoinedCommunities = {
    title: "가입한 커뮤니티",
    joined: allJoined,
    membershipError: directory.membershipError,
  };
  return useNativeScreen("social-joined", model, {
    header: backHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") handle(action);
    },
  });
}

/** A page body that is only a status line (loading, not found, invalid address), drawn natively. */
export function NativePageStateBridge({
  state,
  onBack,
  onSearch,
  onCreate,
}: {
  state: NativePageState;
  onBack: () => void;
  onSearch: () => void;
  onCreate?: () => void;
}) {
  return useNativeScreen("social-page-state", state, {
    header: backHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type === "create") onCreate?.();
    },
  });
}

/**
 * In the app a community (CommunityDetailScreen) is drawn natively: info, join control, the manager's
 * members button, membership errors and the post feed with infinite scroll. `onCreate` adds the floating
 * "글쓰기" button of the community page.
 */
export function NativeCommunityDetailBridge({
  community: selected,
  sort = "LATEST",
  onManage,
  onProfile,
  onComments,
  onBack,
  onSearch,
  onCreate,
}: {
  community: Community;
  sort?: PostSort;
  onManage?: () => void;
  onProfile: (userId: number) => void;
  onComments: (postId: number) => void;
  onBack: () => void;
  onSearch: () => void;
  onCreate?: () => void;
}) {
  const { role } = useGalleryRole(selected.galleryId);
  const canManage = Boolean(role?.canManage);
  const membership = useCommunityMembership();
  const communities = useNativeCommunities();
  // Same as the web screen: the gallery list refetched after a join/leave carries the fresh member count.
  const galleries = useGalleries();
  const community = useMemo(() => {
    if (galleries.status !== "ready") return selected;
    const fresh = galleries.galleries.find((gallery) => gallery.galleryId === selected.galleryId);
    return fresh ? galleryToCommunity(fresh) : selected;
  }, [galleries, selected]);
  const posts = useGalleryPosts(community.galleryId, { sort });
  const { feed, handle, sources } = useNativeFeed({
    posts,
    moderation: { galleryId: community.galleryId, canManage },
    texts: {
      loadingText: "게시글을 불러오는 중...",
      errorText: "이 커뮤니티의 게시글을 불러오지 못했습니다.",
      emptyText: "아직 게시글이 없어요.",
    },
    autoMore: true,
    endNotice: true,
    onComments,
    onProfile,
  });

  const model: NativeCommunityDetail = {
    community: communities.card(community),
    manage: canManage && onManage !== undefined,
    membershipError: membership.error
      ? {
          message: membership.error,
          retry: membership.loadFailed,
          retryDisabled: membership.loading,
        }
      : null,
    feed,
    createLabel: onCreate ? "글쓰기" : null,
  };
  const node = useNativeScreen("social-community", model, {
    header: backHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "toggle-join":
          return communities.toggle(community.id);
        case "manage":
          return onManage?.();
        case "membership-retry":
          return membership.retryLoad();
        case "create":
          return onCreate?.();
        case "more":
          return posts.loadMore();
        default:
          return handle(action);
      }
    },
  });
  return (
    <>
      {sources}
      {node}
    </>
  );
}

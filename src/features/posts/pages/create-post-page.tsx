import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { SocialCreateForm, useSocialCreate } from "@/features/community/create-content";
import { useCommunityMembership } from "@/features/community/community-membership";
import { useGalleries } from "@/features/community/use-galleries";
import { resolvePostTarget } from "@/features/community/post-target";
import { PostCommunityPicker } from "@/features/community/post-community-picker";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useLocation, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { postKeys } from "@/features/posts/post-queries";
import { NativePostCreateBridge } from "@/features/posts/native-post-create-bridge";
import { profileKeys } from "@/features/profile/profile-queries";
import { nativeApp } from "@/lib/native-app";

export default function CreatePostPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const galleries = useGalleries();
  const membership = useCommunityMembership();
  const retryCommunities = () => {
    galleries.refetch();
    membership.retryLoad();
  };
  const joinedGalleries = {
    ...(membership.loading
      ? { status: "loading" as const }
      : membership.loadFailed
        ? { status: "error" as const }
        : galleries.status === "ready"
          ? {
              status: "ready" as const,
              galleries: galleries.galleries.filter(
                (gallery) =>
                  membership.isJoined(gallery.galleryId) &&
                  !membership.isPending(gallery.galleryId),
              ),
            }
          : galleries),
    refetch: retryCommunities,
  };
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const target = galleryId ?? DEFAULT_GALLERY_ID;
  const [, setQuery] = useSearchParams();
  const location = useLocation();
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const choose = (id: number) =>
    setQuery(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("galleryId", String(id));
        return next;
      },
      { replace: true, state: location.state },
    );
  const form = useSocialCreate({
    kind: "post",
    galleryId: target,
    postTargetStatus: resolvePostTarget(galleries, target, membership),
    onCancel: () => back("/social"),
    onCreated: () => {
      // 새 글이 들어간 목록과 내 프로필 활동을 돌아가자마자 다시 받게 한다.
      void queryClient.invalidateQueries({ queryKey: postKeys.lists(userId) });
      if (userId !== null)
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId, userId) });
      back("/social");
    },
  });
  if (nativeApp())
    return (
      <>
        <SocialCreateForm form={form} />
        <NativePostCreateBridge
          form={form}
          galleries={joinedGalleries}
          galleryId={target}
          onCommunity={choose}
          onBack={() => back("/social")}
          onSearch={search}
        />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/social")}
          onSearch={search}
          communitySelector={
            <PostCommunityPicker galleries={joinedGalleries} value={target} onChange={choose} />
          }
        />
        <div className={sharedStyles.screenBody}>
          <SocialCreateForm form={form} />
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

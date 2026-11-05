import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { SocialCreate } from "@/features/community/create-content";
import { useGalleries } from "@/features/community/use-galleries";
import { resolvePostTarget } from "@/features/community/post-target";
import { PostCommunityPicker } from "@/features/community/post-community-picker";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useLocation, useSearchParams } from "react-router";

export default function CreatePostPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const galleries = useGalleries(0);
  const target = galleryId ?? DEFAULT_GALLERY_ID;
  const [, setQuery] = useSearchParams();
  const location = useLocation();
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/social")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
          communitySelector={
            <PostCommunityPicker
              galleries={galleries}
              value={target}
              onChange={(id) => setQuery((previous) => {
                const next = new URLSearchParams(previous);
                next.set("galleryId", String(id));
                return next;
              }, { replace: true, state: location.state })}
            />
          }
        />
        <div className={sharedStyles.screenBody}>
          <SocialCreate
            kind="post"
            galleryId={target}
            postTargetStatus={resolvePostTarget(galleries, target)}
            onCancel={() => back("/social")}
            onCreated={() => back("/social")}
          />
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

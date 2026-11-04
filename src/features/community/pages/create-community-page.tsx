import { useState } from "react";
import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { SocialCreate } from "@/features/community/create-content";
import { MyGalleryProposals } from "@/features/community/my-gallery-proposals";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";

export default function CreateCommunityPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const signedIn = useCurrentUserId() !== null;
  const [submissions, setSubmissions] = useState(0);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/communities")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={sharedStyles.screenBody}>
          {signedIn ? (
            <>
              <MyGalleryProposals revision={submissions} submitted={submissions > 0} />
              <SocialCreate
                key={submissions}
                kind="community"
                galleryId={DEFAULT_GALLERY_ID}
                onCancel={() => back("/communities")}
                onCreated={() => setSubmissions((value) => value + 1)}
              />
            </>
          ) : (
            <SignInRequired>커뮤니티 개설 신청은 로그인 후 사용할 수 있습니다.</SignInRequired>
          )}
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { SocialCreateForm, useSocialCreate } from "@/features/community/create-content";
import { MyGalleryProposals } from "@/features/community/my-gallery-proposals";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { galleryKeys } from "@/features/community/community-queries";
import { nativeApp } from "@/lib/native-app";
import {
  createCommunitySignInMessage,
  NativeCreateCommunityBridge,
} from "@/features/community/native-create-community-bridge";

type FormProps = {
  submissions: number;
  onCancel: () => void;
  onCreated: () => void;
  onSearch: () => void;
};

/** The proposal form; the page remounts it (key) after each proposal for an empty form. */
function CommunityProposalForm({ submissions, onCancel, onCreated, onSearch }: FormProps) {
  const form = useSocialCreate({
    kind: "community",
    galleryId: DEFAULT_GALLERY_ID,
    onCancel,
    onCreated,
  });
  return (
    <>
      <SocialCreateForm form={form} />
      {nativeApp() && (
        <NativeCreateCommunityBridge
          form={form}
          submitted={submissions > 0}
          formKey={submissions}
          onBack={onCancel}
          onSearch={onSearch}
        />
      )}
    </>
  );
}

export default function CreateCommunityPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const userId = useCurrentUserId();
  const signedIn = userId !== null;
  const queryClient = useQueryClient();
  const [submissions, setSubmissions] = useState(0);
  const onBack = () => back("/communities");
  const onSearch = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        {signedIn ? (
          <CommunityProposalForm
            key={submissions}
            submissions={submissions}
            onCancel={onBack}
            onSearch={onSearch}
            onCreated={() => {
              setSubmissions((value) => value + 1);
              void queryClient.invalidateQueries({ queryKey: galleryKeys.myProposals(userId) });
            }}
          />
        ) : (
          <NativeCreateCommunityBridge
            form={null}
            submitted={false}
            formKey={0}
            onBack={onBack}
            onSearch={onSearch}
          />
        )}
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header minimal onBack={onBack} onSearch={onSearch} />
        <div className={sharedStyles.screenBody}>
          {signedIn ? (
            <>
              <MyGalleryProposals submitted={submissions > 0} />
              <CommunityProposalForm
                key={submissions}
                submissions={submissions}
                onCancel={onBack}
                onSearch={onSearch}
                onCreated={() => {
                  setSubmissions((value) => value + 1);
                  void queryClient.invalidateQueries({ queryKey: galleryKeys.myProposals(userId) });
                }}
              />
            </>
          ) : (
            <SignInRequired>{createCommunitySignInMessage}</SignInRequired>
          )}
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

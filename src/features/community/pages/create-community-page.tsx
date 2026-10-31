import { SocialCreate } from "@/features/community/create-content";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
export default function CreateCommunityPage() {
  const { to, back } = useAppNavigation();
  return (
    <SocialCreate
      kind="community"
      galleryId={DEFAULT_GALLERY_ID}
      onCancel={() => back("/communities")}
      onCreated={(gallery) => {
        if (gallery) to(`/communities/${gallery.galleryId}`, { replace: true });
        else back("/communities");
      }}
    />
  );
}

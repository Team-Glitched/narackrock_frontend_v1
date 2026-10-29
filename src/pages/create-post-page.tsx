import { SocialCreate } from "@/features/screens/social-create";
import { useGalleries } from "@/hooks/use-galleries";
import { resolvePostTarget } from "@/features/community/post-target";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function CreatePostPage() {
  const { galleryId, back } = useAppNavigation();
  const galleries = useGalleries(0);
  const target = galleryId ?? DEFAULT_GALLERY_ID;
  return <SocialCreate kind="post" galleryId={target} postTargetStatus={resolvePostTarget(galleries, target)} onCancel={() => back("/social")} onCreated={() => back("/social")} />;
}

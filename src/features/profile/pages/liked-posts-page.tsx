import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { LikedPostsScreen } from "../liked-posts-screen";
import { sharedStyles } from "@/styles/shared.styles";

export default function LikedPostsPage() {
  const { to, back } = useUrlNavigation();
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/profile")} onSearch={() => to("/search?scope=posts")} />
        <div className={sharedStyles.screenBody}>
          <LikedPostsScreen onOpenPost={(id) => to(`/posts/${id}`)} />
        </div>
      </div>
    </DesignViewport>
  );
}

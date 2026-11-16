import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { nativeApp } from "@/lib/native-app";
import { LikedPostsScreen } from "../liked-posts-screen";
import { NativeLikedPostsBridge } from "../native-profile-bridge";
import { sharedStyles } from "@/styles/shared.styles";

export default function LikedPostsPage() {
  const { to, back } = useUrlNavigation();
  const search = () => to("/search?scope=posts");
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/profile")} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <LikedPostsScreen onOpenPost={(id) => to(`/posts/${id}`)} />
          {nativeApp() && (
            <NativeLikedPostsBridge onOpenPost={(id) => to(`/posts/${id}`)} onSearch={search} onBack={() => back("/profile")} />
          )}
        </div>
      </div>
    </DesignViewport>
  );
}

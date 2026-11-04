import { DesignViewport } from "@/components/ui/design-viewport";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { ChatScreen } from "@/features/social/chat-screen";

export default function ChatPage() {
  const { to, back, params, query } = useUrlNavigation();
  const friendId = readId(query.get("userId"));
  const { openNotifications } = useNotificationsNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>

        <div className={sharedStyles.screenBody}>
          <ChatScreen
            friendId={friendId}
            onBack={() => back(friendId === null ? "/friends" : "/chat")}
            onSearch={() => to(withQuery("/search", { scope, galleryId }))}
            onNotifications={openNotifications}
            onSelect={(id) => to(`/chat?userId=${id}`)}
            onProfile={(id) => to(`/users/${id}`)}
          />
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

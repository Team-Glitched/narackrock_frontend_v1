import { DesignViewport } from "@/components/design-viewport";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { nativeApp } from "@/lib/native-app";
import { sharedStyles } from "@/styles/shared.styles";
import { ChatScreen } from "@/features/social/chat-screen";
import { NativeChatBridge } from "@/features/social/native-chat-bridge";

export default function ChatPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const friendId = readId(query.get("userId"));
  const { openNotifications } = useNotificationsNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const chat = {
    friendId,
    query: query.get("q") ?? "",
    onQueryChange: (value: string) => {
      const next = new URLSearchParams(query);
      if (value) next.set("q", value);
      else next.delete("q");
      to(`/chat${next.size ? `?${next}` : ""}`, { replace: true });
    },
    onBack: () => back(friendId === null ? "/friends" : "/chat"),
    onSearch: () => to(withQuery("/search", { scope, galleryId })),
    onSelect: (id: number) => {
      const next = new URLSearchParams(query);
      next.set("userId", String(id));
      to(`/chat?${next}`);
    },
    onProfile: (id: number) => to(`/users/${id}`),
  };
  if (nativeApp())
    return (
      <>
        <NativeChatBridge {...chat} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatScreen
            {...chat}
            onNotifications={openNotifications}
            onMyProfile={() => to("/profile")}
            onLogin={() => to("/login", { state: { returnTo: currentPath } })}
          />
        </div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}

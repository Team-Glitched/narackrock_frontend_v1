import { NotificationBell } from "@/features/notifications/notification-bell";
import { ChatShortcut } from "@/features/social/chat-shortcut";
import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-session";
import { useUrlNavigation } from "./use-url-navigation";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { nativeApp } from "@/lib/native-app";
function Logo() {
  return (
    <Asset name="auth-logo.svg" alt="Narackrock" className={"h-[43px] w-17 flex-[0_0_68px]"} />
  );
}

const headerControl =
  "grid size-11 place-items-center p-[10px] [&>img]:h-auto [&>img]:w-auto [&>img]:max-h-none [&>img]:max-w-none [&>img]:shrink-0";

export function Header({
  onSearch,
  showChat = false,
  abyss = false,
  muted = false,
  onToggleMute,
  onBack,
  onSettings,
  communitySelector,
}: {
  onSearch: () => void;
  showChat?: boolean;
  abyss?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  onSettings?: () => void;
  communitySelector?: ReactNode;
}) {
  const { currentUserId, headerProfileImageUrl } = useAuthSession();
  const { to, currentPath } = useUrlNavigation();
  const { openNotifications } = useNotificationsNavigation();
  if (nativeApp()) return null;
  return (
    <header
      className={cn(
        "flex h-12 flex-[0_0_48px] items-center justify-between pr-2 pl-4",
        (onBack || abyss) && "pl-1.5",
      )}
    >
      {onBack ? (
        <button className={headerControl} aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
      ) : abyss ? (
        <button
          className={cn(headerControl, "p-3")}
          aria-label="무음"
          aria-pressed={muted}
          title={muted ? "소리 켜기" : "소리 끄기"}
          onClick={onToggleMute}
        >
          <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
        </button>
      ) : (
        <button
          className={"block h-[43px] w-17 shrink-0"}
          aria-label="홈으로"
          onClick={() => to("/")}
        >
          <Logo />
        </button>
      )}
      <div className="flex h-11 items-center gap-1 overflow-hidden">
        <NotificationBell className={headerControl} onClick={openNotifications} />
        {showChat && currentUserId !== null && (
          <ChatShortcut className={headerControl} onClick={() => to("/chat")} />
        )}
        <button className={headerControl} aria-label="검색" onClick={onSearch}>
          <Asset name="v3-search.svg" />
        </button>
        {currentUserId === null ? (
          <button
            className={cn(buttonVariants({ tone: "primary", size: "compact" }), "mr-2 shrink-0")}
            onClick={() => to("/login", { state: { returnTo: currentPath } })}
          >
            로그인
          </button>
        ) : (
          (communitySelector ?? (
            <button
              aria-label={onSettings ? "설정" : "프로필"}
              className={cn(headerControl, !onSettings && "p-1.5 [&_.avatar]:border-0")}
              onClick={onSettings ?? (() => to("/profile"))}
            >
              {onSettings ? (
                <Asset name="settings.svg" />
              ) : (
                <Avatar size="md" src={headerProfileImageUrl} />
              )}
            </button>
          ))
        )}
      </div>
    </header>
  );
}

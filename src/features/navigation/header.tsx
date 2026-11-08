import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-session";
import { useUrlNavigation } from "./use-url-navigation";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
function Logo() {
  return (
    <Asset name="auth-logo.svg" alt="Narackrock" className={"h-[43px] w-17 flex-[0_0_68px]"} />
  );
}

const headerControl =
  "grid size-11 place-items-center p-[10px] [&>img]:h-auto [&>img]:w-auto [&>img]:max-h-none [&>img]:max-w-none [&>img]:shrink-0";

export function Header({
  onSearch,
  abyss = false,
  muted = false,
  onToggleMute,
  onBack,
  onSettings,
  communitySelector,
}: {
  onSearch: () => void;
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
  return (
    <header
      className={cn(
        "flex h-11 flex-[0_0_44px] items-center justify-between pr-1 pl-[15px]",
        abyss && "px-2",
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
        <button className={"block h-[43px] w-17"} aria-label="홈으로" onClick={() => to("/")}>
          <Logo />
        </button>
      )}
      <div className={cn("flex h-11 items-start gap-[10px] overflow-hidden", abyss && "gap-2")}>
        <button className={headerControl} aria-label="알림" onClick={openNotifications}>
          <Asset name="v3-bell.svg" />
        </button>
        <button className={headerControl} aria-label="검색" onClick={onSearch}>
          <Asset name="v3-search.svg" />
        </button>
        {currentUserId === null ? (
          <button
            className={cn(buttonVariants({ tone: "primary", size: "compact" }), "my-auto")}
            onClick={() => to("/login", { state: { returnTo: currentPath } })}
          >
            로그인
          </button>
        ) : (
          (communitySelector ?? (
            <button
              aria-label={onSettings ? "설정" : "프로필"}
              className={cn(headerControl, !onSettings && "p-[7px] [&_.avatar]:border-0")}
              onClick={onSettings ?? (() => to("/profile"))}
            >
              {onSettings ? <Asset name="settings.svg" /> : <Avatar src={headerProfileImageUrl} />}
            </button>
          ))
        )}
      </div>
    </header>
  );
}

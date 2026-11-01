import { sharedStyles } from "@/styles/shared.styles";
import { iconSlotVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { Navigate, View } from "@/features/navigation/types";
import type { ShortItemDto } from "@/lib/api/contracts";

// The five footer tabs. `studio` is the center action button, not a real tab.
type FooterTab = "home" | "abyss" | "studio" | "social" | "opensource";
// Single source of truth for which footer tab is active on the current screen. Sub-screens use the selected variants shown in their Figma frames; header-driven screens (search/profile/edit) and the footer-less studio/note screens map to none. A future URL router only needs to change this map.
const viewToFooterTab: Partial<Record<View, FooterTab>> = {
  home: "home",
  abyss: "abyss",
  social: "social",
  friends: "social",
  community: "social",
  joined: "social",
  opensource: "opensource",
  opensourceDetail: "opensource",
  opensourceComments: "opensource",
};
const activeFooterTab = (view: View): FooterTab | null => viewToFooterTab[view] ?? null;

const assetRoot = "/figma/";

/** Figma layout slots exclude the SVG's painted stroke overflow. */
export function IconSlot({
  name,
  kind,
}: {
  name: string;
  kind: "mini" | "post" | "short" | "post-save" | "short-save" | "short-share" | "nav";
}) {
  return (
    <span className={iconSlotVariants({ kind })} aria-hidden="true">
      <Asset name={name} />
    </span>
  );
}

export function Asset({
  name,
  alt = "",
  className = "",
}: {
  name: string;
  alt?: string;
  className?: string;
}) {
  // Local Figma exports keep their explicit layout dimensions.
  return <img src={`${assetRoot}${name}`} alt={alt} className={className} draggable={false} />;
}

export function Avatar({
  large = false,
  src = null,
  className,
}: {
  large?: boolean;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        cn(
          sharedStyles.avatar,
          "block size-[30px] flex-none overflow-hidden rounded-full border border-solid border-app-fg bg-[#555] [&>img]:size-full [&>img]:object-cover",
        ),
        large && cn(sharedStyles.avatarLarge, "size-[140px] border-2"),
        className,
      )}
    >
      {src ? (
        <img src={src} alt="프로필" draggable={false} />
      ) : (
        <Asset name="profile.png" alt="프로필" />
      )}
    </span>
  );
}

function Logo() {
  return (
    <Asset name="auth-logo.svg" alt="Narackrock" className={"h-[43px] w-17 flex-[0_0_68px]"} />
  );
}

const headerControl =
  "grid size-11 place-items-center p-[10px] [&>img]:h-auto [&>img]:w-auto [&>img]:max-h-none [&>img]:max-w-none [&>img]:shrink-0";

export function Header({
  onSearch,
  onProfile,
  onNotifications,
  profileImageUrl = null,
  blank = false,
  abyss = false,
  muted = false,
  onToggleMute,
  back = false,
  onBack,
  onHome,
  onSettings,
  communitySelector,
}: {
  onSearch: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  profileImageUrl?: string | null;
  blank?: boolean;
  abyss?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  back?: boolean;
  onBack?: () => void;
  onHome?: () => void;
  onSettings?: () => void;
  communitySelector?: React.ReactNode;
}) {
  if (blank) return <div className={"h-11 flex-[0_0_44px]"} />;
  return (
    <header
      className={cn(
        "flex h-11 flex-[0_0_44px] items-center justify-between pr-1 pl-[15px]",
        abyss && "px-2",
      )}
    >
      {back || onBack ? (
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
        <button className={"block h-[43px] w-17"} aria-label="홈으로" onClick={onHome}>
          <Logo />
        </button>
      )}
      <div className={cn("flex h-11 items-start gap-[10px] overflow-hidden", abyss && "gap-2")}>
        <button className={headerControl} aria-label="알림" onClick={onNotifications}>
          <Asset name="v3-bell.svg" />
        </button>
        <button className={headerControl} aria-label="검색" onClick={onSearch}>
          <Asset name="v3-search.svg" />
        </button>
        {communitySelector ?? (
          <button
            aria-label={onSettings ? "설정" : "프로필"}
            className={cn(headerControl, !onSettings && "p-[7px] [&_.avatar]:border-0")}
            onClick={onSettings ?? onProfile}
          >
            {onSettings ? <Asset name="settings.svg" /> : <Avatar src={profileImageUrl} />}
          </button>
        )}
      </div>
    </header>
  );
}

const nav: { id: FooterTab; label: string }[] = [
  { id: "home", label: "홈" },
  { id: "abyss", label: "어비스" },
  { id: "studio", label: "" },
  { id: "social", label: "소셜" },
  { id: "opensource", label: "오픈소스" },
];
export function Footer({
  view,
  go,
  onCreate,
  createLabel = "곡 만들기",
}: {
  view: View;
  go: Navigate;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const active = activeFooterTab(view);
  return (
    <footer className={sharedStyles.appFooter}>
      {nav.map((item) => (
        <button
          key={item.id}
          className={cn(
            item.id === "studio" ? sharedStyles.makeButton : "",
            item.id === active ? sharedStyles.active : "",
          )}
          onClick={() => (item.id === "studio" && onCreate ? onCreate() : go(item.id))}
          aria-label={item.id === "studio" ? createLabel : item.label}
          aria-current={item.id === active ? "page" : undefined}
        >
          {item.id === "studio" ? (
            <>
              <Asset name="make-circle.svg" />
              <i />
            </>
          ) : (
            <IconSlot name={`nav-${item.id}-${item.id === active ? "on" : "off"}.svg`} kind="nav" />
          )}
          {item.label && <span>{item.label}</span>}
        </button>
      ))}
    </footer>
  );
}
export function SectionTitle({
  children,
  onAll,
  allLabel = "모두보기",
}: {
  children: ReactNode;
  onAll?: () => void;
  allLabel?: string;
}) {
  return (
    <div
      className={cn(
        sharedStyles.sectionTitle,
        "mb-[10px] flex h-[18px] items-center justify-between px-4",
      )}
    >
      <h2 className={"m-0 w-[247px] text-title leading-[18px] font-bold tracking-[-0.4px]"}>
        {children}
      </h2>
      {onAll && (
        <button
          className={
            "relative text-label leading-[18px] font-medium text-app-muted after:absolute after:inset-x-0 after:-inset-y-[9px] after:content-['']"
          }
          onClick={onAll}
        >
          {allLabel}
        </button>
      )}
    </div>
  );
}
export function SongRail({
  songs,
  onOpen,
}: {
  songs: ShortItemDto[];
  onOpen: (shortId: number) => void;
}) {
  return (
    <div className={sharedStyles.songRail}>
      {songs.map((song) => (
        <button
          type="button"
          className={sharedStyles.songCard}
          key={song.shortId}
          onClick={() => onOpen(song.shortId)}
          aria-label={`${song.title} 열기`}
        >
          <span className={sharedStyles.songArt}>
            {song.albumImageUrl ? (
              <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
            ) : (
              <span className={sharedStyles.emptyArtwork} />
            )}
          </span>
          <strong>{song.title}</strong>
          <small>{song.author.nickname}</small>
        </button>
      ))}
    </div>
  );
}

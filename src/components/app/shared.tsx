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
const activeFooterTab = (view: View): FooterTab | null =>
  viewToFooterTab[view] ?? null;

const assetRoot = "/figma/";
export const postImages = ["abyss-album.png", "profile.png"];

/** Figma layout slots exclude the SVG's painted stroke overflow. */
export function IconSlot({name,kind}:{name:string;kind:"mini"|"post"|"short"|"post-save"|"short-save"|"short-share"|"nav"}) {
  return <span className={`figma-icon-slot figma-icon-slot--${kind}`} aria-hidden="true"><Asset name={name}/></span>;
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
  // Assets are local Figma exports with explicit CSS sizing; Next Image adds no benefit here.
  return (

    <img
      src={`${assetRoot}${name}`}
      alt={alt}
      className={className}
      draggable={false}
    />
  );
}

export function Avatar({ large = false, src = null }: { large?: boolean; src?: string | null }) {
  const className = large ? "avatar avatar--large" : "avatar";
  if (src) {

    return <span className={className}><img src={src} alt="프로필" draggable={false} /></span>;
  }
  return <span className={className}><Asset name="profile.png" alt="프로필" /></span>;
}

function Logo() { return <Asset name="auth-logo.svg" alt="Narackrock" className="nr-logo" />; }

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
  if (blank) return <div className="header-spacer" />;
  return (
    <header className={`app-header${abyss ? " app-header--shorts" : ""}`}>
      {back || onBack ? (
        <button className="header-back" aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
      ) : abyss ? (
        <button
          className="header-sound"
          aria-label="무음"
          aria-pressed={muted}
          title={muted ? "소리 켜기" : "소리 끄기"}
          onClick={onToggleMute}
        >
          <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
        </button>
      ) : (
        <button className="header-logo" aria-label="홈으로" onClick={onHome}>
          <Logo />
        </button>
      )}
      <div className="header-actions">
        <button aria-label="알림" onClick={onNotifications}>
          <Asset name="v3-bell.svg" />
        </button>
        <button aria-label="검색" onClick={onSearch}>
          <Asset name="v3-search.svg" />
        </button>
        {communitySelector ?? <button
          aria-label={onSettings ? "설정" : "프로필"}
          className={onSettings ? "header-settings" : "header-profile"}
          onClick={onSettings ?? onProfile}
        >
          {onSettings ? <Asset name="settings.svg" /> : <Avatar src={profileImageUrl} />}
        </button>}
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
export function Footer({ view, go, onCreate, createLabel = "곡 만들기" }: { view: View; go: Navigate; onCreate?:()=>void; createLabel?:string }) {
  const active = activeFooterTab(view);
  return (
    <footer className="app-footer">
      {nav.map((item) => (
        <button
          key={item.id}
          className={`${item.id === "studio" ? "make-button" : ""} ${item.id === active ? "active" : ""}`}
          onClick={() => item.id === "studio" && onCreate ? onCreate() : go(item.id)}
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
    <div className="section-title">
      <h2>{children}</h2>
      {onAll && <button onClick={onAll}>{allLabel}</button>}
    </div>
  );
}
export function SongRail({ songs, onOpen }: { songs: ShortItemDto[]; onOpen: (shortId: number) => void }) {
  return <div className="song-rail">{songs.map(song => <button type="button" className="song-card" key={song.shortId} onClick={() => onOpen(song.shortId)} aria-label={`${song.title} 열기`}><span className="song-art">{song.albumImageUrl

    ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
    : <span className="empty-artwork" />}</span><strong>{song.title}</strong><small>{song.author.nickname}</small></button>)}</div>;
}

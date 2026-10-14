import type { ReactNode } from "react";
import type { Navigate, View } from "@/features/navigation/types";
import type { ShortItemDto } from "@/lib/api/contracts";

// The five footer tabs. `studio` is the center action button, not a real tab.
type FooterTab = "home" | "abyss" | "studio" | "social" | "opensource";
// Single source of truth for which footer tab is active on the current screen. Sub-screens map to the tab they were opened from (charts/posts belong to home); header-driven screens (search/profile/edit) and the footer-less studio/note screens map to none. A future URL router only needs to change this map.
const viewToFooterTab: Partial<Record<View, FooterTab>> = {
  home: "home",
  charts: "home",
  posts: "home",
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
    // eslint-disable-next-line @next/next/no-img-element
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
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={className}><img src={src} alt="프로필" draggable={false} /></span>;
  }
  return <span className={className}><Asset name="profile.png" alt="프로필" /></span>;
}

function Logo() { return <Asset name="auth-logo.svg" alt="Narackrock" className="nr-logo" />; }

export function Header({
  onSearch,
  onProfile,
  onNotifications,
  notificationCount = 0,
  hideProfileAction = false,
  profileImageUrl = null,
  blank = false,
  abyss = false,
  muted = false,
  onToggleMute,
  back = false,
  onBack,
  onHome,
}: {
  onSearch: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  notificationCount?: number;
  hideProfileAction?: boolean;
  profileImageUrl?: string | null;
  blank?: boolean;
  abyss?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  back?: boolean;
  onBack?: () => void;
  onHome?: () => void;
}) {
  if (blank) return <div className="header-spacer" />;
  return (
    <header className="app-header">
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
        <button className="header-notification" aria-label={`알림${notificationCount ? ` ${notificationCount}개` : ""}`} onClick={onNotifications}>
          <Asset name="bell.svg" />
          {notificationCount > 0 && <span className="header-notification-badge">{notificationCount > 99 ? "99+" : notificationCount}</span>}
        </button>
        <button aria-label="검색" onClick={onSearch}>
          <Asset name="search.svg" />
        </button>
        {!hideProfileAction && <button
          aria-label="프로필"
          className="header-profile"
          onClick={onProfile}
        >
          <Avatar src={profileImageUrl} />
        </button>}
      </div>
    </header>
  );
}

// Footer icons are inline SVGs (not <img>) so the active state can be driven from one source (the `.active` class) in CSS: the interior fill toggles neutral/100 <-> none while the stroke stays neutral/200. Geometry mirrors public/figma/{home,abyss,friend,community}.svg; colors are left to CSS so they map to design tokens.
const iconStroke = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const footerIcons: Partial<Record<FooterTab, ReactNode>> = {
  home: (
    <svg className="footer-icon" viewBox="0 0 21.0003 22" aria-hidden>
      <path
        d="M11.537 1.53077C11.1662 1.23904 10.9807 1.09318 10.776 1.03711C10.5953 0.987632 10.4049 0.987632 10.2243 1.03711C10.0195 1.09318 9.83409 1.23904 9.46325 1.53077L2.30415 7.16264C1.82559 7.53911 1.58631 7.72734 1.41393 7.96307C1.26123 8.17189 1.14748 8.40713 1.07827 8.65724C1.00013 8.93959 1.00013 9.24619 1.00013 9.85939V17.5836C1.00013 18.7794 1.00013 19.3774 1.23022 19.8341C1.43262 20.2359 1.75558 20.5626 2.15281 20.7673C2.6044 21 3.19557 21 4.3779 21H6.48901C6.7846 21 6.93239 21 7.04529 20.9418C7.1446 20.8906 7.22534 20.809 7.27593 20.7085C7.33346 20.5943 7.33346 20.4449 7.33346 20.1459V13.0996C7.33346 12.5016 7.33346 12.2027 7.44851 11.9743C7.54971 11.7734 7.71119 11.6101 7.9098 11.5077C8.1356 11.3914 8.43118 11.3914 9.02235 11.3914H11.9779C12.5691 11.3914 12.8647 11.3914 13.0904 11.5077C13.2891 11.6101 13.4505 11.7734 13.5517 11.9743C13.6668 12.2027 13.6668 12.5016 13.6668 13.0996V20.1459C13.6668 20.4449 13.6668 20.5943 13.7243 20.7085C13.7749 20.809 13.8557 20.8906 13.955 20.9418C14.0679 21 14.2157 21 14.5112 21H16.6223C17.8047 21 18.3958 21 18.8474 20.7673C19.2447 20.5626 19.5676 20.2359 19.77 19.8341C20.0001 19.3774 20.0001 18.7794 20.0001 17.5836V9.85939C20.0001 9.24619 20.0001 8.93959 19.922 8.65724C19.8528 8.40713 19.739 8.17189 19.5863 7.96307C19.4139 7.72734 19.1747 7.53911 18.6961 7.16264L11.537 1.53077Z"
        {...iconStroke}
      />
    </svg>
  ),
  abyss: (
    <svg className="footer-icon" viewBox="0 0 22 22" aria-hidden>
      <path
        d="M1 6.33333C1 4.46649 1 3.53307 1.36331 2.82003C1.68289 2.19283 2.19283 1.68289 2.82003 1.36331C3.53307 1 4.46649 1 6.33333 1H15.6667C17.5335 1 18.4669 1 19.18 1.36331C19.8072 1.68289 20.3171 2.19283 20.6367 2.82003C21 3.53307 21 4.46649 21 6.33333V15.6667C21 17.5335 21 18.4669 20.6367 19.18C20.3171 19.8072 19.8072 20.3171 19.18 20.6367C18.4669 21 17.5335 21 15.6667 21H6.33333C4.46649 21 3.53307 21 2.82003 20.6367C2.19283 20.3171 1.68289 19.8072 1.36331 19.18C1 18.4669 1 17.5335 1 15.6667V6.33333Z"
        {...iconStroke}
      />
      <path
        className="footer-icon-knockout"
        d="M8.40741 13.9467V8.1332C8.40741 7.89279 8.40741 7.77259 8.45067 7.6751C8.4888 7.58916 8.55021 7.51588 8.62779 7.46373C8.7158 7.40456 8.83308 7.3848 9.06764 7.34527L13.4133 6.61305C13.7298 6.55971 13.8881 6.53305 14.0115 6.57936C14.1197 6.62001 14.2104 6.69771 14.2679 6.79896C14.3333 6.91435 14.3333 7.07656 14.3333 7.40097V12.9482M8.40741 13.9467C8.40741 14.7739 7.74413 15.4444 6.92593 15.4444C6.10773 15.4444 5.44445 14.7739 5.44445 13.9467C5.44445 13.1195 6.10773 12.449 6.92593 12.449C7.74413 12.449 8.40741 13.1195 8.40741 13.9467ZM14.3333 12.9482C14.3333 13.7754 13.6701 14.446 12.8519 14.446C12.0337 14.446 11.3704 13.7754 11.3704 12.9482C11.3704 12.121 12.0337 11.4505 12.8519 11.4505C13.6701 11.4505 14.3333 12.121 14.3333 12.9482Z"
        {...iconStroke}
      />
    </svg>
  ),
  social: (
    <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" {...iconStroke} />
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...iconStroke} />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" {...iconStroke} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...iconStroke} />
    </svg>
  ),
  opensource: (
    <svg
      className="footer-icon footer-icon--opensource"
      viewBox="0 0 20 20"
      aria-hidden
    >
      <mask id="opensource-icon-mask" fill="white">
        <path
          className="opensource-mask-shape"
          d="M6.90983 19.5106C4.64533 18.7748 2.71768 17.2551 1.4736 15.225C0.229513 13.1948 -0.249359 10.7874 0.123116 8.43566C0.495591 6.08394 1.69497 3.9423 3.50552 2.39594C5.31607 0.849586 7.61897 8.2313e-7 10 0C12.381 -8.23129e-7 14.6839 0.849582 16.4945 2.39594C18.305 3.94229 19.5044 6.08393 19.8769 8.43565C20.2494 10.7874 19.7705 13.1948 18.5264 15.225C17.2823 17.2551 15.3547 18.7748 13.0902 19.5106L10.7574 12.3311C11.3124 12.1507 11.7849 11.7783 12.0898 11.2807C12.3948 10.7831 12.5121 10.193 12.4208 9.61657C12.3296 9.04016 12.0356 8.51524 11.5918 8.13623C11.148 7.75721 10.5836 7.54898 10 7.54898C9.4164 7.54898 8.85196 7.75721 8.40819 8.13623C7.96442 8.51524 7.67045 9.04016 7.57915 9.61658C7.48786 10.193 7.60523 10.7831 7.91016 11.2807C8.21509 11.7783 8.68756 12.1507 9.24259 12.3311L6.90983 19.5106Z"
        />
      </mask>
      <path
        className="opensource-logo-shape"
        d="M6.90983 19.5106C4.64533 18.7748 2.71768 17.2551 1.4736 15.225C0.229513 13.1948 -0.249359 10.7874 0.123116 8.43566C0.495591 6.08394 1.69497 3.9423 3.50552 2.39594C5.31607 0.849586 7.61897 8.2313e-7 10 0C12.381 -8.23129e-7 14.6839 0.849582 16.4945 2.39594C18.305 3.94229 19.5044 6.08393 19.8769 8.43565C20.2494 10.7874 19.7705 13.1948 18.5264 15.225C17.2823 17.2551 15.3547 18.7748 13.0902 19.5106L10.7574 12.3311C11.3124 12.1507 11.7849 11.7783 12.0898 11.2807C12.3948 10.7831 12.5121 10.193 12.4208 9.61657C12.3296 9.04016 12.0356 8.51524 11.5918 8.13623C11.148 7.75721 10.5836 7.54898 10 7.54898C9.4164 7.54898 8.85196 7.75721 8.40819 8.13623C7.96442 8.51524 7.67045 9.04016 7.57915 9.61658C7.48786 10.193 7.60523 10.7831 7.91016 11.2807C8.21509 11.7783 8.68756 12.1507 9.24259 12.3311L6.90983 19.5106Z"
        strokeWidth="4"
        mask="url(#opensource-icon-mask)"
      />
    </svg>
  ),
};
const nav: { id: FooterTab; label: string }[] = [
  { id: "home", label: "홈" },
  { id: "abyss", label: "어비스" },
  { id: "studio", label: "" },
  { id: "social", label: "소셜" },
  { id: "opensource", label: "오픈소스" },
];
export function Footer({ view, go }: { view: View; go: Navigate }) {
  const active = activeFooterTab(view);
  return (
    <footer className="app-footer">
      {nav.map((item) => (
        <button
          key={item.id}
          className={`${item.id === "studio" ? "make-button" : ""} ${item.id === active ? "active" : ""}`}
          onClick={() => go(item.id)}
          aria-label={item.id === "studio" ? "곡 만들기" : item.label}
          aria-current={item.id === active ? "page" : undefined}
        >
          {item.id === "studio" ? (
            <>
              <Asset name="make-circle.svg" />
              <i />
            </>
          ) : (
            footerIcons[item.id]
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
}: {
  children: ReactNode;
  onAll?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {onAll && <button onClick={onAll}>모두보기</button>}
    </div>
  );
}
export function SongRail({ songs, onOpen }: { songs: ShortItemDto[]; onOpen: (shortId: number) => void }) {
  return <div className="song-rail">{songs.map(song => <button type="button" className="song-card" key={song.shortId} onClick={() => onOpen(song.shortId)} aria-label={`${song.title} 열기`}><span className="song-art">{song.albumImageUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
    : <Asset name="abyss-album.png" alt={`${song.title} 기본 앨범 커버`} />}</span><strong>{song.title}</strong><small>{song.author.nickname}</small></button>)}</div>;
}

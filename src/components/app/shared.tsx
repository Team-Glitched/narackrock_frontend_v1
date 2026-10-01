import type { ReactNode } from "react";
import type { Navigate, View } from "@/features/navigation/types";

// The five footer tabs. `studio` is the center action button, not a real tab.
type FooterTab = "home" | "abyss" | "studio" | "friends" | "community";
// Single source of truth for which footer tab is active on the current screen. Sub-screens map to the tab they were opened from (charts/posts belong to home); header-driven screens (search/profile/edit) and the footer-less studio/note screens map to none. A future URL router only needs to change this map.
const viewToFooterTab: Partial<Record<View, FooterTab>> = { home: "home", charts: "home", posts: "home", abyss: "abyss", friends: "friends", community: "community" };
const activeFooterTab = (view: View): FooterTab | null => viewToFooterTab[view] ?? null;

const assetRoot = "/figma/";
export const postImages = ["abyss-album.png", "profile.png"];

export function Asset({ name, alt = "", className = "" }: { name: string; alt?: string; className?: string }) {
  // Assets are local Figma exports with explicit CSS sizing; Next Image adds no benefit here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${assetRoot}${name}`} alt={alt} className={className} draggable={false} />;
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

export function Header({ onSearch, onProfile, onNotifications, onBack, profileImageUrl = null, blank = false, abyss = false }: { onSearch: () => void; onProfile: () => void; onNotifications: () => void; onBack?: () => void; profileImageUrl?: string | null; blank?: boolean; abyss?: boolean }) {
  if (blank) return <div className="header-spacer" />;
  // 앞자리는 화면에 따라 뒤로가기 > 소리 > 로고 순으로 하나만 쓴다.
  const leading = onBack
    ? <button className="header-back" aria-label="뒤로" onClick={onBack}><Asset name="return.svg" /></button>
    : abyss
      ? <button className="header-sound" aria-label="소리"><Asset name="sound.svg" /></button>
      : <Logo />;
  return <header className="app-header">{leading}<div className="header-actions"><button aria-label="알림" onClick={onNotifications}><Asset name="bell.svg" /></button><button aria-label="검색" onClick={onSearch}><Asset name="search.svg" /></button><button aria-label="프로필" className="header-profile" onClick={onProfile}><Avatar src={profileImageUrl} /></button></div></header>;
}

// Footer icons are inline SVGs (not <img>) so the active state can be driven from one source (the `.active` class) in CSS: the interior fill toggles neutral/100 <-> none while the stroke stays neutral/200. Geometry mirrors public/figma/{home,abyss,friend,community}.svg; colors are left to CSS so they map to design tokens.
const iconStroke = { strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const footerIcons: Partial<Record<FooterTab, ReactNode>> = {
  home: <svg className="footer-icon" viewBox="0 0 21.0003 22" aria-hidden><path d="M11.537 1.53077C11.1662 1.23904 10.9807 1.09318 10.776 1.03711C10.5953 0.987632 10.4049 0.987632 10.2243 1.03711C10.0195 1.09318 9.83409 1.23904 9.46325 1.53077L2.30415 7.16264C1.82559 7.53911 1.58631 7.72734 1.41393 7.96307C1.26123 8.17189 1.14748 8.40713 1.07827 8.65724C1.00013 8.93959 1.00013 9.24619 1.00013 9.85939V17.5836C1.00013 18.7794 1.00013 19.3774 1.23022 19.8341C1.43262 20.2359 1.75558 20.5626 2.15281 20.7673C2.6044 21 3.19557 21 4.3779 21H6.48901C6.7846 21 6.93239 21 7.04529 20.9418C7.1446 20.8906 7.22534 20.809 7.27593 20.7085C7.33346 20.5943 7.33346 20.4449 7.33346 20.1459V13.0996C7.33346 12.5016 7.33346 12.2027 7.44851 11.9743C7.54971 11.7734 7.71119 11.6101 7.9098 11.5077C8.1356 11.3914 8.43118 11.3914 9.02235 11.3914H11.9779C12.5691 11.3914 12.8647 11.3914 13.0904 11.5077C13.2891 11.6101 13.4505 11.7734 13.5517 11.9743C13.6668 12.2027 13.6668 12.5016 13.6668 13.0996V20.1459C13.6668 20.4449 13.6668 20.5943 13.7243 20.7085C13.7749 20.809 13.8557 20.8906 13.955 20.9418C14.0679 21 14.2157 21 14.5112 21H16.6223C17.8047 21 18.3958 21 18.8474 20.7673C19.2447 20.5626 19.5676 20.2359 19.77 19.8341C20.0001 19.3774 20.0001 18.7794 20.0001 17.5836V9.85939C20.0001 9.24619 20.0001 8.93959 19.922 8.65724C19.8528 8.40713 19.739 8.17189 19.5863 7.96307C19.4139 7.72734 19.1747 7.53911 18.6961 7.16264L11.537 1.53077Z" {...iconStroke} /></svg>,
  abyss: <svg className="footer-icon" viewBox="0 0 22 22" aria-hidden><path d="M1 6.33333C1 4.46649 1 3.53307 1.36331 2.82003C1.68289 2.19283 2.19283 1.68289 2.82003 1.36331C3.53307 1 4.46649 1 6.33333 1H15.6667C17.5335 1 18.4669 1 19.18 1.36331C19.8072 1.68289 20.3171 2.19283 20.6367 2.82003C21 3.53307 21 4.46649 21 6.33333V15.6667C21 17.5335 21 18.4669 20.6367 19.18C20.3171 19.8072 19.8072 20.3171 19.18 20.6367C18.4669 21 17.5335 21 15.6667 21H6.33333C4.46649 21 3.53307 21 2.82003 20.6367C2.19283 20.3171 1.68289 19.8072 1.36331 19.18C1 18.4669 1 17.5335 1 15.6667V6.33333Z" {...iconStroke} /><path className="footer-icon-knockout" d="M8.40741 13.9467V8.1332C8.40741 7.89279 8.40741 7.77259 8.45067 7.6751C8.4888 7.58916 8.55021 7.51588 8.62779 7.46373C8.7158 7.40456 8.83308 7.3848 9.06764 7.34527L13.4133 6.61305C13.7298 6.55971 13.8881 6.53305 14.0115 6.57936C14.1197 6.62001 14.2104 6.69771 14.2679 6.79896C14.3333 6.91435 14.3333 7.07656 14.3333 7.40097V12.9482M8.40741 13.9467C8.40741 14.7739 7.74413 15.4444 6.92593 15.4444C6.10773 15.4444 5.44445 14.7739 5.44445 13.9467C5.44445 13.1195 6.10773 12.449 6.92593 12.449C7.74413 12.449 8.40741 13.1195 8.40741 13.9467ZM14.3333 12.9482C14.3333 13.7754 13.6701 14.446 12.8519 14.446C12.0337 14.446 11.3704 13.7754 11.3704 12.9482C11.3704 12.121 12.0337 11.4505 12.8519 11.4505C13.6701 11.4505 14.3333 12.121 14.3333 12.9482Z" {...iconStroke} /></svg>,
  friends: <svg className="footer-icon" viewBox="0 0 22.0001 20.0005" aria-hidden><path d="M17.0487 13.8369C18.514 14.5683 19.7702 15.742 20.6872 17.2096C20.8688 17.5003 20.9596 17.6456 20.991 17.8468C21.0548 18.2558 20.7733 18.7585 20.39 18.9204C20.2014 19 19.9892 19 19.5648 19M15.0358 9.53224C16.5271 8.79589 17.5519 7.26686 17.5519 5.5C17.5519 3.73314 16.5271 2.20411 15.0358 1.46776M13.023 5.5C13.023 7.98528 10.9953 10 8.49403 10C5.99276 10 3.96509 7.98528 3.96509 5.5C3.96509 3.01472 5.99276 1 8.49403 1C10.9953 1 13.023 3.01472 13.023 5.5ZM1.50862 16.9383C3.11318 14.5446 5.6452 13 8.49403 13C11.3429 13 13.8749 14.5446 15.4794 16.9383C15.831 17.4628 16.0067 17.725 15.9865 18.0599C15.9707 18.3207 15.7987 18.64 15.5889 18.7976C15.3196 19 14.9491 19 14.2082 19H2.77987C2.03895 19 1.66849 19 1.39913 18.7976C1.1894 18.64 1.01734 18.3207 1.00158 18.0599C0.981346 17.725 1.1571 17.4628 1.50862 16.9383Z" {...iconStroke} /></svg>,
  community: <svg className="footer-icon" viewBox="0 0 22 22" aria-hidden><path d="M9.00003 14L5.92477 17.1137C5.49582 17.548 5.28134 17.7652 5.09698 17.7805C4.93704 17.7938 4.78045 17.7295 4.67599 17.6076C4.55559 17.4672 4.55559 17.162 4.55559 16.5515V14.9916C4.55559 14.444 4.1071 14.0477 3.56523 13.9683C2.25377 13.7762 1.22381 12.7463 1.03171 11.4348C1.00003 11.2186 1.00003 10.9605 1.00003 10.4444V5.8C1.00003 4.11984 1.00003 3.27976 1.32701 2.63803C1.61463 2.07354 2.07357 1.6146 2.63806 1.32698C3.27979 1 4.11987 1 5.80003 1H13.2C14.8802 1 15.7203 1 16.362 1.32698C16.9265 1.6146 17.3854 2.07354 17.673 2.63803C18 3.27976 18 4.11984 18 5.8V10M18 21L15.8236 19.4869C15.5177 19.2742 15.3647 19.1678 15.1982 19.0924C15.0505 19.0255 14.8951 18.9768 14.7356 18.9474C14.5559 18.9143 14.3696 18.9143 13.9969 18.9143H12.2C11.0799 18.9143 10.5199 18.9143 10.092 18.6963C9.71572 18.5046 9.40976 18.1986 9.21802 17.8223C9.00003 17.3944 9.00003 16.8344 9.00003 15.7143V13.2C9.00003 12.0799 9.00003 11.5198 9.21802 11.092C9.40976 10.7157 9.71572 10.4097 10.092 10.218C10.5199 10 11.0799 10 12.2 10H17.8C18.9201 10 19.4802 10 19.908 10.218C20.2843 10.4097 20.5903 10.7157 20.782 11.092C21 11.5198 21 12.0799 21 13.2V15.9143C21 16.8462 21 17.3121 20.8478 17.6797C20.6448 18.1697 20.2555 18.5591 19.7654 18.762C19.3979 18.9143 18.9319 18.9143 18 18.9143V21Z" {...iconStroke} /></svg>,
};
const nav: { id: FooterTab; label: string }[] = [{ id: "home", label: "홈" }, { id: "abyss", label: "어비스" }, { id: "studio", label: "" }, { id: "friends", label: "친구" }, { id: "community", label: "커뮤니티" }];
export function Footer({ view, go }: { view: View; go: Navigate }) { const active = activeFooterTab(view); return <footer className="app-footer">{nav.map(item => <button key={item.id} className={`${item.id === "studio" ? "make-button" : ""} ${item.id === active ? "active" : ""}`} onClick={() => go(item.id)} aria-label={item.id === "studio" ? "곡 만들기" : item.label} aria-current={item.id === active ? "page" : undefined}>{item.id === "studio" ? <><Asset name="make-circle.svg" /><i /></> : footerIcons[item.id]}{item.label && <span>{item.label}</span>}</button>)}</footer>; }
export function SectionTitle({ children, onAll }: { children: ReactNode; onAll?: () => void }) { return <div className="section-title"><h2>{children}</h2>{onAll && <button onClick={onAll}>모두보기</button>}</div>; }
export function SongRail() { return <div className="song-rail">{Array.from({ length: 10 }).map((_, i) => <button className="song-card" key={i}><span className="song-art"><Asset name={postImages[(i * 7 + 1) % postImages.length]} alt="곡 커버" /></span><strong>Name</strong><small>name</small></button>)}</div>; }

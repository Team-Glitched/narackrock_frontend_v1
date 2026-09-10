import type { ReactNode } from "react";
import type { Navigate, View } from "@/features/navigation/types";

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

function Logo() { return <div className="nr-logo" aria-label="Narackrock"><Asset name="logo-wing-a.svg" /><Asset name="logo-wing-b.svg" /><Asset name="logo-dot.svg" /><b>NR</b></div>; }

export function Header({ onSearch, onProfile, blank = false, abyss = false }: { onSearch: () => void; onProfile: () => void; blank?: boolean; abyss?: boolean }) {
  if (blank) return <div className="header-spacer" />;
  return <header className="app-header">{abyss ? <button className="header-sound" aria-label="소리"><Asset name="sound.svg" /></button> : <Logo />}<div className="header-actions"><button aria-label="알림"><Asset name="bell.svg" /></button><button aria-label="검색" onClick={onSearch}><Asset name="search.svg" /></button><button aria-label="프로필" className="header-profile" onClick={onProfile}><Avatar /></button></div></header>;
}

const nav: { id: View; label: string; icon?: string }[] = [{ id: "home", label: "홈", icon: "home.svg" }, { id: "abyss", label: "어비스", icon: "abyss.svg" }, { id: "studio", label: "", icon: "make-circle.svg" }, { id: "friends", label: "친구", icon: "friend.svg" }, { id: "community", label: "커뮤니티", icon: "community.svg" }];
export function Footer({ view, go }: { view: View; go: Navigate }) { return <footer className="app-footer">{nav.map(item => <button key={item.id} className={`${item.id === "studio" ? "make-button" : ""} ${view === item.id ? "active" : ""}`} onClick={() => go(item.id)} aria-label={item.id === "studio" ? "곡 만들기" : item.label}>{item.icon && <Asset name={item.icon} />}{item.id === "studio" && <i />}{item.label && <span>{item.label}</span>}</button>)}</footer>; }
export function SectionTitle({ children, onAll }: { children: ReactNode; onAll?: () => void }) { return <div className="section-title"><h2>{children}</h2>{onAll && <button onClick={onAll}>모두보기</button>}</div>; }
export function SongRail() { return <div className="song-rail">{Array.from({ length: 10 }).map((_, i) => <button className="song-card" key={i}><span className="song-art"><Asset name={postImages[(i * 7 + 1) % postImages.length]} alt="곡 커버" /></span><strong>Name</strong><small>name</small></button>)}</div>; }

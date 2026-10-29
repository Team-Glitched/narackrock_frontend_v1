import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { FigmaSheet } from "@/components/app/figma-sheet";
import type { GalleriesState } from "@/hooks/use-galleries";
import "./post-community-picker.css";

export function PostCommunityPicker({ galleries, value, onChange }: {
  galleries: GalleriesState & { refetch: () => void };
  value: number;
  onChange: (galleryId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const items = galleries.status === "ready" ? galleries.galleries : [];
  const selected = items.find(item => item.galleryId === value);
  const keyword = query.trim().toLocaleLowerCase();
  const matches = items.filter(item => `${item.name} ${item.description ?? ""}`.toLocaleLowerCase().includes(keyword));

  return <>
    <button type="button" className="post-community-trigger" aria-label={`게시할 커뮤니티 선택${selected ? `: ${selected.name}` : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setOpen(true); }}>
      <span className="post-community-trigger-copy"><small>게시할 커뮤니티</small><strong>{selected?.name ?? "커뮤니티 선택"}</strong></span>
      <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} />
    </button>
    {open && <FigmaSheet title="게시할 커뮤니티 선택" onClose={() => setOpen(false)}>
      <div className="post-community-picker" aria-labelledby={titleId}>
        <header><h2 id={titleId}>게시할 커뮤니티</h2><button type="button" aria-label="커뮤니티 선택 닫기" onClick={() => setOpen(false)}><Asset name="search-close.svg" /></button></header>
        <p>게시글을 올릴 커뮤니티를 선택하세요.</p>
        <label className="post-community-search"><Asset name="search-input.svg" /><input ref={searchInput} aria-label="게시할 커뮤니티 검색" placeholder="커뮤니티 검색" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="커뮤니티 검색어 지우기" onClick={() => { setQuery(""); searchInput.current?.focus(); }}><Asset name="search-close.svg" /></button>}</label>
        {galleries.status === "loading" && <p role="status">커뮤니티를 불러오는 중...</p>}
        {galleries.status === "error" && <div className="post-community-load-error" role="alert"><p>커뮤니티를 불러오지 못했습니다.</p><button type="button" className="gray-pill" onClick={galleries.refetch}>다시 시도</button></div>}
        {galleries.status === "ready" && <ul aria-label="게시할 커뮤니티 목록">{matches.map(item => <li key={item.galleryId}><button type="button" aria-pressed={value === item.galleryId} onClick={() => { onChange(item.galleryId); setOpen(false); }}>
          <Avatar src={item.imageUrl} /><span className="post-community-option-copy"><strong>{item.name}</strong><small>가입자 {item.subscriberCount.toLocaleString("ko-KR")}명</small></span>{value === item.galleryId && <span className="post-community-selected">선택됨</span>}
        </button></li>)}</ul>}
        {galleries.status === "ready" && matches.length === 0 && <p role="status">{keyword ? "검색 결과가 없습니다." : "게시할 수 있는 커뮤니티가 없습니다."}</p>}
      </div>
    </FigmaSheet>}
  </>;
}

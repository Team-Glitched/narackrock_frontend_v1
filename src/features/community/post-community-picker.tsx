import { buttonVariants } from "@/styles/variants";
import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { FigmaSheet } from "@/components/app/figma-sheet";
import type { GalleriesState } from "@/hooks/use-galleries";

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
    <button type="button" className="flex h-11 w-[154px] items-center justify-between gap-[10px] rounded-xl border-0 bg-app-surface px-3 py-[6px] text-left [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-app-fg" aria-label={`게시할 커뮤니티 선택${selected ? `: ${selected.name}` : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setOpen(true); }}>
      <span className="flex min-w-0 flex-col gap-1 [&>small]:text-caption [&>small]:leading-3 [&>small]:font-medium [&>small]:text-app-muted [&>strong]:truncate [&>strong]:text-body [&>strong]:leading-[17px] [&>strong]:font-semibold [&>strong]:text-app-fg"><small>게시할 커뮤니티</small><strong>{selected?.name ?? "커뮤니티 선택"}</strong></span>
      <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} />
    </button>
    {open && <FigmaSheet title="게시할 커뮤니티 선택" onClose={() => setOpen(false)}>
      <div className="pt-3 pb-6 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-4 [&_h2]:m-0 [&_h2]:text-title [&_h2]:leading-[26px] [&_h2]:font-bold [&_h2]:text-app-fg [&>header>button]:grid [&>header>button]:size-10 [&>header>button]:shrink-0 [&>header>button]:place-items-center [&>header>button>img]:size-4 [&_p]:mt-3 [&_p]:mb-6 [&_p]:text-body [&_p]:leading-[21px] [&_p]:font-normal [&_p]:text-app-muted [&>ul]:m-0 [&>ul]:mt-5 [&>ul]:flex [&>ul]:list-none [&>ul]:flex-col [&>ul]:gap-2 [&>ul]:p-0" aria-labelledby={titleId}>
        <header><h2 id={titleId}>게시할 커뮤니티</h2><button type="button" aria-label="커뮤니티 선택 닫기" onClick={() => setOpen(false)}><Asset name="search-close.svg" /></button></header>
        <p>게시글을 올릴 커뮤니티를 선택하세요.</p>
        <label className="flex h-11 items-center gap-[10px] rounded-xl bg-app-surface px-3 [&>img]:size-[18px] [&>img]:shrink-0 [&>input]:min-w-0 [&>input]:w-full [&>input]:flex-1 [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-body [&>input]:leading-5 [&>input]:font-normal [&>input]:text-app-fg [&>button]:grid [&>button]:h-9 [&>button]:w-7 [&>button]:shrink-0 [&>button]:place-items-center [&>button>img]:size-3"><Asset name="search-input.svg" /><input ref={searchInput} aria-label="게시할 커뮤니티 검색" placeholder="커뮤니티 검색" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="커뮤니티 검색어 지우기" onClick={() => { setQuery(""); searchInput.current?.focus(); }}><Asset name="search-close.svg" /></button>}</label>
        {galleries.status === "loading" && <p role="status">커뮤니티를 불러오는 중...</p>}
        {galleries.status === "error" && <div className="pt-5" role="alert"><p>커뮤니티를 불러오지 못했습니다.</p><button type="button" className={buttonVariants({
  tone: "secondary"
})} onClick={galleries.refetch}>다시 시도</button></div>}
        {galleries.status === "ready" && <ul aria-label="게시할 커뮤니티 목록">{matches.map(item => <li key={item.galleryId}><button className={"flex min-h-[70px] w-full items-center gap-3 rounded-xl border border-solid border-transparent p-3 text-left aria-pressed:bg-app-surface"} type="button" aria-pressed={value === item.galleryId} onClick={() => { onChange(item.galleryId); setOpen(false); }}>
          <Avatar src={item.imageUrl} className={"size-10 border-0"} /><span className={"flex min-w-0 flex-1 flex-col gap-2 [&>strong]:text-label [&>strong]:leading-5 [&>strong]:font-semibold [&>strong]:text-app-fg [&>strong]:[overflow-wrap:anywhere] [&>small]:text-caption [&>small]:leading-4 [&>small]:font-normal [&>small]:text-app-muted"}><strong>{item.name}</strong><small>가입자 {item.subscriberCount.toLocaleString("ko-KR")}명</small></span>{value === item.galleryId && <span className={"text-caption leading-[18px] font-medium whitespace-nowrap text-app-primary-soft"}>선택됨</span>}
        </button></li>)}</ul>}
        {galleries.status === "ready" && matches.length === 0 && <p role="status">{keyword ? "검색 결과가 없습니다." : "게시할 수 있는 커뮤니티가 없습니다."}</p>}
      </div>
    </FigmaSheet>}
  </>;
}

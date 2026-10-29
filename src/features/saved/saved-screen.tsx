import { filterChipVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { useSavedItems, type SavedItem } from "./saved-store";

const filterClass = filterChipVariants();

export function SavedScreen({ onOpenPost, onOpenSong }: { onOpenPost: (id: number) => void; onOpenSong: (id: number) => void }) {
  const { items, toggle } = useSavedItems();
  const hiddenPosts = useHiddenPosts();
  return <SavedLibrary items={items.filter(item => item.kind !== "post" || !hiddenPosts.ids.has(item.id))} onRemove={toggle} onOpenPost={onOpenPost} onOpenSong={onOpenSong} />;
}
export function SavedLibrary({ items, onRemove, onOpenPost, onOpenSong }: {
  items: SavedItem[]; onRemove: (item: SavedItem) => void;
  onOpenPost: (id: number) => void; onOpenSong: (id: number) => void;
}) {
  const [kind, setKind] = useState<"post" | "song">("post");
  const [menu, setMenu] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = items.filter(item => item.kind === kind);
  return <section className="scrollbar-none h-full overflow-x-hidden overflow-y-auto px-5 py-[30px]" aria-label={uiLabels.saved}>
    <h1 className="m-0 mb-6 text-title leading-7 font-bold">{uiLabels.saved}</h1>
    <div className="flex items-center gap-[10px]" aria-label="저장 목록 종류">
      <button className={filterClass} aria-pressed={kind === "post"} onClick={() => { setKind("post"); setMenu(null); }}>게시글</button>
      <button className={filterClass} aria-pressed={kind === "song"} onClick={() => { setKind("song"); setMenu(null); }}>음악</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {visible.length === 0 ? <p className="my-[70px] text-center text-body leading-[1.8] text-app-muted">저장한 {kind === "post" ? "게시글" : "음악"}이 없습니다.<br />마음에 드는 콘텐츠의 저장 버튼을 눌러보세요.</p> : <ul className={cn("my-[30px] flex list-none flex-col gap-[30px] p-0", kind === "song" && "mt-5")}>
      {visible.map(item => <li key={item.id} className="relative flex items-center gap-1">
        <button className={cn("flex min-w-0 flex-1 items-center gap-[10px] text-left", kind === "post" && "items-start gap-5")} onClick={() => kind === "post" ? onOpenPost(item.id) : onOpenSong(item.id)}>
          <span className={cn("h-[52px] flex-[0_0_52px] overflow-hidden rounded-[5px] bg-app-fg [&>img]:size-full [&>img]:object-cover", kind === "post" && "h-[90px] flex-[0_0_90px] rounded")}>{item.imageUrl &&
            <img src={item.imageUrl} alt="" />}</span>
          <span className={cn("flex min-w-0 flex-col gap-2 [&>strong]:text-label [&>strong]:leading-[1.3] [&>strong]:font-semibold [&>small]:text-body [&>small]:text-app-muted", kind === "post" && "gap-5 [&>strong]:line-clamp-2 [&>strong]:text-body [&>strong]:font-medium")}><strong>{item.title}</strong>{kind === "post" ? <span className="flex items-center gap-[6px] text-caption"><Avatar className="size-5" /><span>{item.author}</span></span> : <small>{item.author}</small>}</span>
        </button>
        <button className={cn("grid min-h-11 w-10 flex-[0_0_40px] place-items-center [&>img]:size-5", kind === "post" && "absolute -right-[10px] -bottom-[18px]")} aria-label={`${item.title} 저장 옵션`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}><Asset name="option.svg" /></button>
        {menu === item.id && <div className="absolute top-full right-0 z-5 rounded-lg bg-app-surface shadow-[0_4px_18px_#0005] [&>button]:px-5 [&>button]:py-3 [&>button]:text-body"><button onClick={() => { try { onRemove(item); setMenu(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "저장 해제에 실패했습니다."); } }}>저장 해제</button></div>}
      </li>)}
    </ul>}
    <p className="m-0 mt-6 text-caption leading-[1.6] text-app-muted">이 브라우저에 저장한 콘텐츠입니다.</p>
  </section>;
}

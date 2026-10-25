"use client";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { useSavedItems, type SavedItem } from "./saved-store";

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
  return <section className={`saved-view scroll-content saved-view--${kind}`} aria-label={uiLabels.saved}>
    <h1>{uiLabels.saved}</h1>
    <div className="filter-chips" aria-label="저장 목록 종류">
      <button aria-pressed={kind === "post"} onClick={() => { setKind("post"); setMenu(null); }}>게시글</button>
      <button aria-pressed={kind === "song"} onClick={() => { setKind("song"); setMenu(null); }}>음악</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {visible.length === 0 ? <p className="library-empty">저장한 {kind === "post" ? "게시글" : "음악"}이 없습니다.<br />마음에 드는 콘텐츠의 저장 버튼을 눌러보세요.</p> : <ul className="saved-list">
      {visible.map(item => <li key={item.id} className={`saved-item saved-item--${kind}`}>
        <button className="saved-open" onClick={() => kind === "post" ? onOpenPost(item.id) : onOpenSong(item.id)}>
          <span className="saved-art">{item.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.imageUrl} alt="" />}</span>
          <span className="saved-copy"><strong>{item.title}</strong>{kind === "post" ? <span className="saved-author"><Avatar /><span>{item.author}</span></span> : <small>{item.author}</small>}</span>
        </button>
        <button className="saved-menu-trigger" aria-label={`${item.title} 저장 옵션`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}><Asset name="option.svg" /></button>
        {menu === item.id && <div className="saved-menu"><button onClick={() => { try { onRemove(item); setMenu(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "저장 해제에 실패했습니다."); } }}>저장 해제</button></div>}
      </li>)}
    </ul>}
    <p className="local-storage-note">이 브라우저에 저장한 콘텐츠입니다.</p>
  </section>;
}

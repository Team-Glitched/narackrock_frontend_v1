import type { PostSort } from "@/lib/api/contracts";

export function PostListControls({ sort, onSortChange }: { sort: PostSort; onSortChange: (sort: PostSort) => void }) {
  return (
    <label className="flex items-center justify-end gap-2 px-4 py-3 text-sm">
      게시글 정렬
      <select
        aria-label="게시글 정렬"
        className="rounded border border-current bg-transparent px-2 py-1"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as PostSort)}
      >
        <option value="LATEST">최신순</option>
        <option value="POPULAR">인기순</option>
        <option value="OLDEST">오래된순</option>
      </select>
    </label>
  );
}

import { Dropdown } from "@/components/dropdown";
import type { PostSort } from "@/lib/api/contracts";

const sortOptions = [
  { value: "LATEST", label: "최신순" },
  { value: "POPULAR", label: "인기순" },
  { value: "OLDEST", label: "오래된순" },
] as const;

export function PostListControls({ sort, onSortChange }: { sort: PostSort; onSortChange: (sort: PostSort) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm">
      <span className="text-app-muted">게시글 정렬</span>
      <Dropdown
        label="게시글 정렬"
        className="min-w-32"
        options={sortOptions}
        value={sort}
        onChange={onSortChange}
      />
    </div>
  );
}

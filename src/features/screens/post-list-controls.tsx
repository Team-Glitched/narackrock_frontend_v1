import { useState } from "react";
import type { PostSort } from "@/lib/api/contracts";

const SORT_LABELS: ReadonlyArray<{ value: PostSort; label: string }> = [
  { value: "LATEST", label: "최신순" },
  { value: "POPULAR", label: "인기순" },
  { value: "OLDEST", label: "오래된순" },
];

/**
 * 게시글 목록의 정렬 탭 + 검색창.
 *
 * 검색어는 입력할 때마다 요청하지 않고 제출(Enter/버튼)할 때만 올린다. 매 글자마다
 * 부르면 서버가 `title LIKE %kw% OR content LIKE %kw%`를 그만큼 돌게 되고, 중간에 비는
 * 순간이 그대로 400(INVALID_SEARCH_KEYWORD)이 되기 때문이다.
 *
 * `keyword`(확정된 검색어)와 입력 중인 초안을 나눠 두고, 바깥에서 검색어가 바뀌면
 * 초안도 맞춘다 — 커뮤니티를 옮기면 검색이 풀려야 한다.
 */
export function PostListControls({ sort, onSortChange, keyword, onKeywordChange }: {
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
  keyword: string | null;
  onKeywordChange: (keyword: string | null) => void;
}) {
  const [draft, setDraft] = useState(keyword ?? "");
  // 확정된 검색어가 바깥에서 바뀌면 입력창도 맞춘다. effect가 아니라 렌더 중에 비교해
  // 조정하는 React 권장 방식이다 — effect 안의 동기 setState는 연쇄 렌더를 만든다.
  const [syncedKeyword, setSyncedKeyword] = useState(keyword);
  if (syncedKeyword !== keyword) {
    setSyncedKeyword(keyword);
    setDraft(keyword ?? "");
  }

  // 공백만 남기고 지우는 경우까지 "검색 안 함"으로 본다 — 서버는 빈 검색어를 400으로 거절한다.
  const submit = () => onKeywordChange(draft.trim() || null);

  return (
    <div className="post-list-controls">
      <form
        className="post-search"
        role="search"
        onSubmit={event => { event.preventDefault(); submit(); }}
      >
        <input
          type="search"
          aria-label="게시글 검색"
          placeholder="제목·내용 검색"
          value={draft}
          onChange={event => setDraft(event.target.value)}
        />
        <button type="submit" className="gray-pill compact">검색</button>
      </form>

      <div className="post-sort" role="group" aria-label="게시글 정렬">
        {SORT_LABELS.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            className={sort === option.value ? "active" : ""}
            onClick={() => onSortChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {keyword && (
        <p className="post-search-active">
          ‘{keyword}’ 검색 결과
          <button type="button" className="gray-pill compact" onClick={() => onKeywordChange(null)}>검색 해제</button>
        </p>
      )}
    </div>
  );
}

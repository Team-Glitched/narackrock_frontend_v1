import { sourceStyles } from "@/styles/source.styles";
import { workspaceStyles } from "@/styles/workspace.styles";
import { AlbumArtwork } from "@/components/music-card";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { SourcePlayback } from "@/features/sources/source-playback";
import { sourceError } from "@/features/sources/source-screens";
import {
  loadSavedSources,
  savedSourcesScope,
  useSourceSaveMutation,
} from "@/features/sources/source-queries";

import { usePagedItems } from "@/hooks/use-paged-items";
import type { SavedOpenSource } from "@/lib/api/open-sources";

/** The account's server-side open source library (`GET /users/me/open-sources`), including unavailable entries. */
export function SavedOpenSources({
  query,
  onOpen,
}: {
  query: string;
  onOpen: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  if (userId === null)
    return <SignInRequired>저장한 샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <SavedSourceList key={userId} query={query} onOpen={onOpen} />;
}

/**
 * The account's saved samples filtered by `query` (title and description), page by page. Returns
 * `current` (null while the first page loads; else `next`, `busy` — a page is loading, `error`),
 * the filtered `items`, `keyword`, `busy` (id being unsaved), `notice` (unsave failure, "" when none),
 * `unsave(id)` (the row leaves the list once the server confirms) and `more` (next page, or retry).
 * Used by SavedOpenSources and the app's native library screen; pass `enabled` false while signed out.
 */
export function useSavedOpenSources(query: string, enabled = true) {
  // Shares `sourceKeys.saved`, which every save/unsave invalidates.
  const {
    state: current,
    more,
    remove,
  } = usePagedItems(savedSourcesScope, 0, loadSavedSources, enabled);
  const unsave = useSourceSaveMutation();
  const busy = unsave.isPending ? unsave.variables.sourceId : null;
  const notice = unsave.error ? sourceError(unsave.error, "보관 해제에 실패했습니다.") : "";
  function unsaveSource(id: number) {
    if (unsave.isPending) return;
    unsave.mutate(
      { sourceId: id, saved: false },
      {
        // The library is reread from its first page; the row leaves at once.
        onSuccess: (result) => {
          if (!result.isSaved) remove((item) => item.openSourceId === id);
        },
      },
    );
  }
  const keyword = query.trim().toLocaleLowerCase();
  const items = (current?.items ?? []).filter(
    (item) =>
      !keyword ||
      (item.source &&
        `${item.source.title} ${item.source.description ?? ""}`
          .toLocaleLowerCase()
          .includes(keyword)),
  );
  return { current, items, keyword, busy, notice, unsave: unsaveSource, more };
}

/** The saved-sample library state and actions of `useSavedOpenSources`. */
export type SavedOpenSourcesState = {
  current: {
    items: SavedOpenSource[];
    next: number | null;
    busy: boolean;
    error: { cause: Error } | null;
  } | null;
  items: SavedOpenSource[];
  keyword: string;
  busy: number | null;
  notice: string;
  unsave: (id: number) => void;
  more: () => void;
};

function SavedSourceList({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  const {
    current,
    items,
    keyword,
    busy,
    notice,
    unsave: unsaveSource,
    more,
  } = useSavedOpenSources(query);
  if (!current)
    return (
      <p role="status" className={workspaceStyles.workspaceEmpty}>
        저장한 샘플을 불러오는 중...
      </p>
    );
  return (
    <>
      {notice && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {notice}
        </p>
      )}
      {items.length === 0 && current.next === null && !current.error && (
        <p className={workspaceStyles.workspaceEmpty}>
          {keyword ? "검색 결과가 없습니다." : "저장한 샘플이 없습니다."}
        </p>
      )}
      {items.map((item) => (
        <article
          className={`${workspaceStyles.workspaceCard} ${sourceStyles.libraryCard}`}
          key={item.openSourceId}
        >
          {item.availability === "AVAILABLE" && item.source ? (
            <>
              <div className="flex items-center gap-3">
                <AlbumArtwork
                  src={item.source.thumbnailUrl}
                  title={item.source.title}
                  seed={`source:${item.openSourceId}`}
                  className="size-12 shrink-0 rounded-[8px]"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="m-0! truncate text-label! leading-6! font-bold! text-app-fg">
                    {item.source.title}
                  </h2>
                  <small className="mt-0.5 block truncate text-body leading-5 text-app-muted">
                    {item.source.writer.nickname}
                  </small>
                </div>
              </div>
              {item.source.description && <p>{item.source.description}</p>}
              <SourcePlayback
                sourceId={item.openSourceId}
                canPreview={item.source.canPreview ?? true}
                durationMs={null}
                label={item.source.title}
                showDurationHint={false}
              />
              <p className="text-caption! leading-5! text-app-muted">
                보관한 뒤 스튜디오의 ‘+ 샘플’에서 레이어에 추가할 수 있습니다. MIDI 샘플은 피아노롤에서도 음표로 불러올 수 있습니다.
              </p>
            </>
          ) : (
            <>
              <h2>사용할 수 없는 샘플</h2>
              <p>삭제되었거나 비공개로 전환되어 재생하거나 곡에 넣을 수 없습니다.</p>
            </>
          )}
          <div className={`${workspaceStyles.workspaceActions} ${sourceStyles.libraryActions}`}>
            <button
              disabled={busy !== null || current.busy}
              onClick={() => unsaveSource(item.openSourceId)}
            >
              {busy === item.openSourceId ? "해제 중..." : "저장 해제"}
            </button>
            {item.availability === "AVAILABLE" && (
              <button
                className={workspaceStyles.workspacePrimary}
                onClick={() => onOpen(item.openSourceId)}
              >
                자세히 보기
              </button>
            )}
          </div>
        </article>
      ))}
      {current.error && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {sourceError(current.error.cause, "보관함을 불러오지 못했습니다.")}
        </p>
      )}
      {current.next !== null && (
        <button
          className={workspaceStyles.workspaceWide}
          disabled={current.busy || busy !== null}
          onClick={more}
        >
          {current.busy ? "불러오는 중..." : current.error ? "다시 시도" : "더보기"}
        </button>
      )}
    </>
  );
}

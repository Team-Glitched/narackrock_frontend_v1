import { sourceStyles } from "@/styles/source.styles";
import { workspaceStyles } from "@/styles/workspace.styles";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { SourcePlayback } from "@/features/sources/source-playback";
import { sourceError } from "@/features/sources/source-screens";
import { loadSavedSources, savedSourcesScope, useSourceSaveMutation } from "@/features/sources/source-queries";

import { usePagedItems } from "@/hooks/use-paged-items";

/** The account's server-side open source library (`GET /users/me/open-sources`), including unavailable entries. */
export function SavedOpenSources({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>저장한 샘플은 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <SavedSourceList key={userId} query={query} onOpen={onOpen} />;
}

function SavedSourceList({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  // Shares `sourceKeys.saved`, which every save/unsave invalidates.
  const { state: current, more, remove } = usePagedItems(savedSourcesScope, 0, loadSavedSources);
  const unsave = useSourceSaveMutation();
  if (!current) return <p role="status" className={workspaceStyles.workspaceEmpty}>저장한 샘플을 불러오는 중...</p>;
  const busy = unsave.isPending ? unsave.variables.sourceId : null;
  const notice = unsave.error ? sourceError(unsave.error, "보관 해제에 실패했습니다.") : "";
  function unsaveSource(id: number) {
    if (unsave.isPending) return;
    unsave.mutate({ sourceId: id, saved: false }, {
      // The library is reread from its first page; the row leaves at once.
      onSuccess: (result) => { if (!result.isSaved) remove((item) => item.openSourceId === id); },
    });
  }
  const keyword = query.trim().toLocaleLowerCase();
  const items = current.items.filter(
    (item) =>
      !keyword ||
      (item.source && `${item.source.title} ${item.source.description ?? ""}`.toLocaleLowerCase().includes(keyword)),
  );
  return (
    <>
      {notice && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {notice}
        </p>
      )}
      {items.length === 0 && current.next === null && !current.error && <p className={workspaceStyles.workspaceEmpty}>{keyword ? "검색 결과가 없습니다." : "저장한 샘플이 없습니다."}</p>}
      {items.map((item) => (
        <article className={`${workspaceStyles.workspaceCard} ${sourceStyles.libraryCard}`} key={item.openSourceId}>
          <span className={workspaceStyles.workspaceStatus}>저장한 샘플</span>
          {item.availability === "AVAILABLE" && item.source ? (
            <>
              <h2>{item.source.title}</h2>
              {item.source.description && <p>{item.source.description}</p>}
              <small>{item.source.writer.nickname}</small>
              <SourcePlayback sourceId={item.openSourceId} canPreview durationMs={null} />
              <p className="text-caption! leading-5! text-app-muted">피아노롤의 ‘+ 샘플’에서 내 레이어에 오디오로 넣을 수 있습니다.</p>
            </>
          ) : (
            <>
              <h2>사용할 수 없는 샘플</h2>
              <p>삭제되었거나 비공개로 전환되어 재생하거나 곡에 넣을 수 없습니다.</p>
            </>
          )}
          <div className={`${workspaceStyles.workspaceActions} ${sourceStyles.libraryActions}`}>
            <button disabled={busy !== null || current.busy} onClick={() => unsaveSource(item.openSourceId)}>
              {busy === item.openSourceId ? "해제 중..." : "저장 해제"}
            </button>
            {item.availability === "AVAILABLE" && (
              <button className={workspaceStyles.workspacePrimary} onClick={() => onOpen(item.openSourceId)}>
                자세히 보기
              </button>
            )}
          </div>
        </article>
      ))}
      {current.error && <p role="alert" className={workspaceStyles.workspaceNotice}>{sourceError(current.error.cause, "보관함을 불러오지 못했습니다.")}</p>}
      {current.next !== null && (
        <button className={workspaceStyles.workspaceWide} disabled={current.busy || busy !== null} onClick={more}>
          {current.busy ? "불러오는 중..." : current.error ? "다시 시도" : "더보기"}
        </button>
      )}
    </>
  );
}

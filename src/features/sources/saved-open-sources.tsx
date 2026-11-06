import { workspaceStyles } from "@/styles/workspace.styles";
import { useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { SourcePlayback } from "@/features/sources/source-playback";
import { sourceError } from "@/features/sources/source-screens";
import { listSavedOpenSources, setOpenSourceSaved } from "@/lib/api/open-sources";

import { usePagedItems } from "@/hooks/use-paged-items";

async function loadSavedSources(page: number, signal: AbortSignal) {
  const result = await listSavedOpenSources(page, signal);
  return { items: result.items, next: result.hasNext ? page + 1 : null };
}

/** The account's server-side open source library (`GET /users/me/open-sources`), including unavailable entries. */
export function SavedOpenSources({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>저장한 오픈소스는 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <SavedSourceList key={userId} query={query} onOpen={onOpen} />;
}

function SavedSourceList({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  const { state: current, more, remove, reload } = usePagedItems("saved-sources", 0, loadSavedSources);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  if (!current) return <p role="status">저장한 오픈소스를 불러오는 중...</p>;
  async function unsave(id: number) {
    if (busy !== null) return;
    setBusy(id);
    setNotice("");
    try {
      const result = await setOpenSourceSaved(id, false);
      if (!result.isSaved) {
        if (current?.next !== null) reload();
        else remove((item) => item.openSourceId === id);
      }
    } catch (cause) {
      setNotice(sourceError(cause, "보관 해제에 실패했습니다."));
    } finally {
      setBusy(null);
    }
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
      {items.length === 0 && current.next === null && !current.error && <p className={workspaceStyles.workspaceNotice}>{keyword ? "검색 결과가 없습니다." : "저장한 오픈소스가 없습니다."}</p>}
      {items.map((item) => (
        <article className={workspaceStyles.workspaceCard} key={item.openSourceId}>
          <span className={workspaceStyles.workspaceStatus}>저장한 오픈소스</span>
          {item.availability === "AVAILABLE" && item.source ? (
            <>
              <h2>{item.source.title}</h2>
              <p>{item.source.description ?? ""}</p>
              <small>{item.source.writer.nickname}</small>
              <SourcePlayback sourceId={item.openSourceId} canPreview durationMs={null} />
              <p className={workspaceStyles.workspaceNotice}>곡에 오픈소스 넣기는 현재 서버에서 지원하지 않습니다.</p>
            </>
          ) : (
            <>
              <h2>사용할 수 없는 오픈소스</h2>
              <p>삭제되었거나 비공개로 전환되어 재생하거나 곡에 넣을 수 없습니다.</p>
            </>
          )}
          <div className={workspaceStyles.workspaceActions}>
            <button disabled={busy !== null || current.busy} onClick={() => void unsave(item.openSourceId)}>
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
      {current.error && <p role="alert">{sourceError(current.error.cause, "보관함을 불러오지 못했습니다.")}</p>}
      {current.next !== null && (
        <button className={workspaceStyles.workspaceWide} disabled={current.busy || busy !== null} onClick={more}>
          {current.busy ? "불러오는 중..." : current.error ? "다시 시도" : "더보기"}
        </button>
      )}
    </>
  );
}

import { workspaceStyles } from "@/styles/workspace.styles";
import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { SourcePlayback } from "@/features/sources/source-playback";
import { sourceError } from "@/features/sources/source-screens";
import { listAllSavedOpenSources, setOpenSourceSaved, type SavedOpenSource } from "@/lib/api/open-sources";

/** The account's server-side open source library (`GET /users/me/open-sources`), including unavailable entries. */
export function SavedOpenSources({ query, onOpen }: { query: string; onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  const [retry, setRetry] = useState(0);
  const key = `${userId}:${retry}`;
  const [loaded, setLoaded] = useState<{ key: string; items: SavedOpenSource[]; error?: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    listAllSavedOpenSources(controller.signal)
      .then((items) => setLoaded({ key, items }))
      .catch((cause) => {
        if (!controller.signal.aborted) setLoaded({ key, items: [], error: sourceError(cause, "보관함을 불러오지 못했습니다.") });
      });
    return () => controller.abort();
  }, [key, userId]);
  if (userId === null) return <SignInRequired>저장한 오픈소스는 로그인 후 볼 수 있습니다.</SignInRequired>;
  const current = loaded?.key === key ? loaded : null;
  if (!current) return <p role="status">저장한 오픈소스를 불러오는 중...</p>;
  if (current.error)
    return (
      <div role="alert">
        <p>{current.error}</p>
        <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
      </div>
    );
  async function unsave(id: number) {
    if (busy !== null) return;
    setBusy(id);
    setNotice("");
    try {
      const result = await setOpenSourceSaved(id, false);
      if (!result.isSaved)
        setLoaded((old) => (old?.key === key ? { ...old, items: old.items.filter((item) => item.openSourceId !== id) } : old));
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
      {items.length === 0 && <p className={workspaceStyles.workspaceNotice}>저장한 오픈소스가 없습니다.</p>}
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
            <button disabled={busy !== null} onClick={() => void unsave(item.openSourceId)}>
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
    </>
  );
}

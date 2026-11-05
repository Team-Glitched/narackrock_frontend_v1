import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { shareLink } from "@/lib/share-link";

export function useShareLink(): { share: (title: string, url: string) => Promise<string | null>; dialog: ReactNode } {
  const userId = useCurrentUserId();
  const scope = JSON.stringify([apiOrigin(), userId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [manual, setManual] = useState<{ title: string; url: string; scope: string } | null>(null);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  useEffect(() => {
    currentScope.current = scope;
    setManual(null); setNotice("");
    return () => { currentScope.current = ""; };
  }, [scope]);
  function select() { input.current?.focus(); input.current?.select(); }
  async function copy() {
    select();
    try { await navigator.clipboard.writeText(manual!.url); setNotice("링크를 복사했습니다."); }
    catch { setNotice("복사하지 못했습니다. 선택된 링크를 키보드로 복사해 주세요."); select(); }
  }
  return {
    share: async (title, url) => {
      const startedScope = scope;
      if (currentScope.current !== startedScope) return null;
      const result = await shareLink(title, url);
      if (currentScope.current !== startedScope) return null;
      if (result.status === "manual") { setManual({ ...result, scope }); setNotice(""); }
      return result.status === "copied" ? "링크를 복사했습니다." : null;
    },
    dialog: manual?.scope === scope ? (
      <CanvasDialog className="w-[min(360px,92%)] rounded-2xl bg-white p-5 text-black shadow-xl" titleId={titleId} onClose={() => setManual(null)}>
        <h2 id={titleId}>링크 공유 · {manual.title}</h2>
        <input ref={input} aria-label="공유 링크" readOnly value={manual.url} onFocus={(event) => event.currentTarget.select()} className="my-3 w-full border p-2" />
        <p>전체 선택 후 Ctrl+C 또는 ⌘C로 복사할 수 있습니다.</p>
        <p role="status">{notice}</p>
        <div className="mt-3 flex gap-3"><button onClick={select}>전체 선택</button><button onClick={() => void copy()}>다시 복사</button><button onClick={() => setManual(null)}>닫기</button></div>
      </CanvasDialog>
    ) : null,
  };
}

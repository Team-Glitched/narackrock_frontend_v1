import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useLayoutEffect, useRef, useState } from "react";
import { AnchoredActionsMenu } from "@/components/anchored-actions-menu";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useShareLink } from "@/hooks/use-share-link";
import { ApiError, apiOrigin } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { getPostShareLink } from "@/lib/api/community";
import { getShortShareLink } from "@/lib/api/shorts";
import { reportPost, reportShort } from "@/lib/api/reports";
import { postError } from "@/features/posts/post-utils";

export function PopularContentActions({ kind, id, title, ownerId }: { kind: "post" | "short"; id: number; title: string; ownerId: number }) {
  const { requireLogin } = useLoginPrompt();
  const userId = useCurrentUserId();
  const scope = JSON.stringify([apiOrigin(), userId, kind, id]);
  const latest = useRef(scope);
  useLayoutEffect(() => {
    latest.current = scope;
  });
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Another account/target closes this row's menu, report sheet and notice.
  const [renderedScope, setRenderedScope] = useState(scope);
  if (renderedScope !== scope) {
    setRenderedScope(scope);
    setMenu(false);
    setReport(false);
    setNotice(null);
    setBusy(false);
  }
  const anchor = useRef<HTMLButtonElement>(null);
  const sharing = useShareLink();
  function authorized() {
    return requireLogin();
  }
  async function share() {
    setMenu(false);
    if (!authorized() || busy) return;
    const started = scope; setBusy(true); setNotice(null);
    try {
      const { shareUrl } = await (kind === "post" ? getPostShareLink(id) : getShortShareLink(id));
      if (latest.current !== started) return;
      anchor.current?.focus();
      const message = await sharing.share(title, canonicalShareLink(kind, id, shareUrl, window.location.origin));
      if (latest.current === started) setNotice(message);
    } catch (cause) { if (latest.current === started) setNotice(cause instanceof ApiError ? cause.message : postError(cause)); }
    finally { if (latest.current === started) setBusy(false); }
  }
  return <>
    <button ref={anchor} type="button" className="min-h-11 min-w-11 shrink-0" aria-label={`${title} 더보기`} aria-haspopup="menu" aria-expanded={menu} aria-disabled={busy} onClick={() => { if (!busy) setMenu(!menu); }}>⋯</button>
    {menu && <AnchoredActionsMenu anchorRef={anchor} label="콘텐츠 작업" className="rounded-xl bg-white p-3 text-black shadow-xl" onClose={() => setMenu(false)}>
      <button role="menuitem" onClick={() => void share()}>공유</button>
      {userId !== ownerId && <button role="menuitem" onClick={() => { setMenu(false); if (authorized()) setReport(true); }}>신고</button>}
    </AnchoredActionsMenu>}
    {notice && <span role="status">{notice}</span>}
    {sharing.dialog}
    {report && userId !== null && userId !== ownerId && <FigmaSheet key={scope} title="신고" onClose={() => setReport(false)}><ReportReasons onSubmit={(reason, description) => (kind === "post" ? reportPost(id, reason, description) : reportShort(id, reason, description))} onDone={() => { if (latest.current === scope) setReport(false); }} /></FigmaSheet>}
  </>;
}

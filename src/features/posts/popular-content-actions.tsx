import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useLayoutEffect, useRef, useState } from "react";
import { AnchoredActionsMenu } from "@/components/anchored-actions-menu";
import { Asset } from "@/components/asset";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useShareLink } from "@/hooks/use-share-link";
import { ApiError, apiOrigin } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { publicWebOrigin } from "@/lib/public-web-origin";
import { getPostShareLink } from "@/lib/api/community";
import { getShortShareLink } from "@/lib/api/shorts";
import { reportPost, reportShort } from "@/lib/api/reports";
import { postError } from "@/features/posts/post-utils";
import { communityStyles } from "@/styles/community.styles";

export function PopularContentActions({ kind, id, title, ownerId }: { kind: "post" | "short"; id: number; title: string; ownerId: number }) {
  const { requireLogin } = useLoginPrompt();
  const userId = useCurrentUserId();
  const showReportAction = userId !== ownerId;
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
      const message = await sharing.share(title, canonicalShareLink(kind, id, shareUrl, publicWebOrigin()));
      if (latest.current === started) setNotice(message);
    } catch (cause) { if (latest.current === started) setNotice(cause instanceof ApiError ? cause.message : postError(cause)); }
    finally { if (latest.current === started) setBusy(false); }
  }
  return <span className="relative inline-flex shrink-0 items-center">
    <button
      ref={anchor}
      type="button"
      className="relative grid size-7 shrink-0 place-items-center rounded-full text-app-muted transition-colors hover:bg-white/10 hover:text-app-fg after:absolute after:-inset-1.5 after:content-[''] [&>img]:size-5"
      aria-label={`${title} 더보기`}
      aria-haspopup="menu"
      aria-expanded={menu}
      aria-disabled={busy}
      onClick={() => { if (!busy) setMenu(!menu); }}
    >
      <Asset name="post-more.svg" />
    </button>
    {menu && (
      <AnchoredActionsMenu
        anchorRef={anchor}
        label="콘텐츠 작업"
        className={communityStyles.postUserActionsMenu}
        width={180}
        height={showReportAction ? 84 : 48}
        onClose={() => setMenu(false)}
      >
        <button type="button" role="menuitem" onClick={() => void share()}>
          공유
        </button>
        {showReportAction && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              if (authorized()) setReport(true);
            }}
          >
            신고
          </button>
        )}
      </AnchoredActionsMenu>
    )}
    {notice && (
      <span
        role="status"
        className="pointer-events-none absolute top-full right-0 z-20 mt-1 whitespace-nowrap rounded-lg bg-app-surface px-2.5 py-1 text-caption text-app-fg shadow-[0_4px_12px_#0006]"
      >
        {notice}
      </span>
    )}
    {sharing.dialog}
    {report && userId !== null && showReportAction && <FigmaSheet key={scope} title="신고" onClose={() => setReport(false)}><ReportReasons onSubmit={(reason, description) => (kind === "post" ? reportPost(id, reason, description) : reportShort(id, reason, description))} onDone={() => { if (latest.current === scope) setReport(false); }} /></FigmaSheet>}
  </span>;
}

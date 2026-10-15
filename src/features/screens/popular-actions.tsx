"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Asset } from "@/components/app/shared";
import { reportPost } from "@/lib/api/community";
import { reportShort } from "@/lib/api/shorts";
import { ApiError } from "@/lib/api/client";
import type { SharedContent } from "@/lib/api/content-link";
import { ContentShareDialog } from "./content-share";

export function PopularActions({ content }: { content: SharedContent }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"share" | "report" | null>(null);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen && !dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); setDialog(null); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, dialog]);

  async function submitReport() {
    if (!reason.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (content.kind === "post") await reportPost(content.id, reason.trim(), description.trim());
      else await reportShort(content.id, reason.trim(), description.trim());
      setDialog(null);
      setReason("");
      setDescription("");
      setMessage("신고가 접수되었습니다.");
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 401
        ? "로그인 후 신고할 수 있습니다."
        : "신고를 접수하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const portal = typeof document === "undefined" ? null : document.querySelector(".phone-frame") ?? document.body;

  return <div className="popular-actions">
    <button type="button" className="popular-more" aria-label={`${content.kind === "post" ? "게시글" : "곡"} 더보기`} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><Asset name="option.svg" /></button>
    {menuOpen && <div className="popular-menu" role="menu">
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setDialog("report"); setMessage(null); }}>신고</button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setDialog("share"); }}>공유</button>
    </div>}
    {message && !dialog && <span className="popular-action-message" role="status">{message}</span>}
    {dialog === "share" && <ContentShareDialog content={content} onClose={() => setDialog(null)} />}
    {dialog === "report" && portal && createPortal(<div className="content-share-layer">
      <button type="button" className="content-share-backdrop" aria-label="신고 창 닫기" onClick={() => setDialog(null)} />
      <section className="content-share-dialog popular-report-dialog" role="dialog" aria-modal="true" aria-label="신고하기">
        <div className="content-share-heading"><h2>신고하기</h2><button type="button" aria-label="신고 창 닫기" onClick={() => setDialog(null)}>×</button></div>
        <label>신고 사유<input autoFocus value={reason} maxLength={100} onChange={event => setReason(event.target.value)} placeholder="신고 사유를 입력해 주세요" /></label>
        <label>상세 설명 (선택)<textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} placeholder="상세 내용을 입력해 주세요" /></label>
        {message && <p role="alert">{message}</p>}
        <button type="button" className="popular-report-submit" disabled={!reason.trim() || busy} onClick={() => void submitReport()}>{busy ? "접수 중..." : "신고 접수"}</button>
      </section>
    </div>, portal)}
  </div>;
}

"use client";

import { useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./moderation.css";

export function ModerationDialog({ title, description, onClose, children, busy = false }: {
  title: string; description: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const opener = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }} className="moderation-dialog" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}
    </DialogContent>
  </Dialog>;
}

export function Failure({ error }: { error: string | null }) {
  return error ? <p className="moderation-error" role="alert">{error}</p> : null;
}

export function ReasonDialog({ title, description, onClose, onSubmit, duration = false, confirmLabel = "확인" }: {
  title: string; description: string; onClose: () => void;
  onSubmit: (reason: string, days?: number) => Promise<void>; duration?: boolean; confirmLabel?: string;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  return <ModerationDialog title={title} description={description} onClose={onClose} busy={busy}>
    <form className="moderation-form" onSubmit={async e => {
      e.preventDefault();
      if (submitting.current || !reason.trim()) return;
      submitting.current = true; setBusy(true); setError(null);
      try { await onSubmit(reason.trim(), duration ? Number(days) : undefined); onClose(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "처리하지 못했습니다. 상태를 확인한 뒤 다시 시도해 주세요."); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      {duration && <label>이용정지 기간 (일)<input type="number" min={1} max={30} step={1} required value={days} onChange={e => setDays(e.target.value)} disabled={busy} /></label>}
      <label>사유<textarea autoFocus required maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} placeholder="조치 사유를 입력해 주세요" /></label>
      <Failure error={error} />
      <div className="moderation-actions"><button type="button" className="gray-pill" onClick={onClose} disabled={busy}>취소</button><button className="purple-pill" disabled={busy || !reason.trim()}>{busy ? "처리 중…" : confirmLabel}</button></div>
    </form>
  </ModerationDialog>;
}

export function GalleryForm({ onSubmit, initialDescription = "", editing = false }: {
  onSubmit: (name: string, description: string) => Promise<void>; initialDescription?: string; editing?: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  return <form className="moderation-form" onSubmit={async e => {
    e.preventDefault();
    if (submitting.current || !description.trim() || (!editing && name.trim().length < 2)) return;
    submitting.current = true; setBusy(true); setError(null); setNotice("");
    try {
      await onSubmit(name.trim(), description.trim());
      setNotice(editing ? "소개를 수정했습니다." : "개설 요청을 접수했습니다. 검토 결과는 내 요청에서 확인해 주세요.");
      if (!editing) { setName(""); setDescription(""); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { submitting.current = false; setBusy(false); }
  }}>
    {!editing && <label>커뮤니티 이름<input required minLength={2} maxLength={30} value={name} onChange={e => setName(e.target.value)} disabled={busy} placeholder="2~30자" /></label>}
    <label>설명<textarea required maxLength={500} rows={5} value={description} onChange={e => setDescription(e.target.value)} disabled={busy} placeholder="어떤 이야기를 나누는 곳인가요?" /><small>{description.length}/500</small></label>
    <Failure error={error} />{notice && <p role="status" className="moderation-notice">{notice}</p>}
    <button className="purple-pill" disabled={busy || !description.trim() || (!editing && name.trim().length < 2)}>{busy ? "저장 중…" : editing ? "소개 저장" : "개설 요청"}</button>
  </form>;
}

export function ListStatus({ list }: { list: { busy: boolean; error: string | null; items: unknown[]; refresh: () => void } }) {
  return <><button className="gray-pill compact" disabled={list.busy} onClick={list.refresh}>새로고침</button><Failure error={list.error} />{list.busy && <p role="status">불러오는 중…</p>}{!list.busy && !list.error && !list.items.length && <p className="moderation-status">내역이 없습니다.</p>}</>;
}
export function More({ list }: { list: { busy: boolean; hasNext: boolean; more: () => Promise<void> } }) {
  return list.hasNext ? <button className="gray-pill" disabled={list.busy} onClick={() => void list.more()}>{list.busy ? '불러오는 중…' : '더 보기'}</button> : null;
}

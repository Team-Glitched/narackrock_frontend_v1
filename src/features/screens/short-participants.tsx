"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/app/shared";
import { participantRole, participantSelection } from "@/features/abyss/participant-selection";
import { getShortComposers, type ShortComposer } from "@/lib/api/shorts";
import "./short-participants.css";

type Props = {
  shortId: number;
  selectedIds: number[] | null;
  onClose: (ids: number[] | null, total: number) => void;
};

export function ShortParticipantsSheet({ shortId, selectedIds, onClose }: Props) {
  const [people, setPeople] = useState<ShortComposer[] | null>(null);
  const [draft, setDraft] = useState(selectedIds);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const dragY = useRef<number | null>(null);
  const ids = participantSelection(people ?? [], draft);
  const uniqueIds = [...new Set((people ?? []).map(person => person.userId))];
  function close() { onClose(people === null ? null : ids, uniqueIds.length); }

  useEffect(() => {
    const controller = new AbortController();
    getShortComposers(shortId, controller.signal).then(result => {
      if (!controller.signal.aborted) { setPeople(result); setError(null); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "참여자를 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [shortId, revision]);

  useEffect(() => {
    const previous = document.activeElement;
    handle.current?.focus({ preventScroll: true });
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  const target = typeof document === "undefined" ? null : document.querySelector(".phone-frame");
  if (!target) return null;
  return createPortal(<div className="short-participants-layer">
    <button className="short-participants-backdrop" aria-label="참여자 선택 적용하고 닫기" onClick={close} tabIndex={-1} />
    <section ref={dialog} className="short-participants-sheet" role="dialog" aria-modal="true" aria-labelledby="short-participants-title"
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); close(); }
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
      }}>
      <button ref={handle} className="short-participants-handle" aria-label="참여자 선택 적용하고 닫기" onClick={() => { if (dragged.current) { dragged.current = false; return; } close(); }}
        onPointerDown={event => { dragged.current = false; dragY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => { const start = dragY.current; dragY.current = null; if (start !== null && event.clientY - start > 45) { dragged.current = true; close(); } }}
        onPointerCancel={() => { dragY.current = null; }}><span /></button>
      <header className="short-participants-heading">
        <div><h2 id="short-participants-title">작곡 참여자</h2><span>{uniqueIds.length}명</span></div>
        <p>듣고 싶은 참여자를 선택해 주세요</p>
      </header>
      <div className="short-participants-list">
        {!people && !error && <p className="short-participants-state" role="status">참여자를 불러오는 중...</p>}
        {error && <div className="short-participants-state" role="alert"><p>{error}</p><button onClick={() => { setError(null); setRevision(value => value + 1); }}>다시 시도</button></div>}
        {people?.length === 0 && <p className="short-participants-state">아직 등록된 참여자가 없어요.</p>}
        {people?.map((person, index) => <label className="short-participant-row" key={`${person.userId}-${index}`}>
          <input type="checkbox" checked={ids.includes(person.userId)} aria-label={`${person.nickname} 트랙 선택`}
            onChange={event => setDraft(event.target.checked ? [...ids, person.userId] : ids.filter(id => id !== person.userId))} />
          <Avatar src={person.profileImageUrl} />
          <span className="short-participant-details"><strong>{person.nickname}</strong><small>{participantRole(person.role)}</small>
            {person.description && <span className="short-participant-description">{person.description}</span>}
          </span>
        </label>)}
      </div>
      <footer className="short-participants-footer">
        <label><input type="checkbox" disabled={!uniqueIds.length} checked={uniqueIds.length > 0 && ids.length === uniqueIds.length}
          onChange={event => setDraft(event.target.checked ? uniqueIds : [])} />전체 선택</label>
        <button onClick={close} disabled={people === null || Boolean(error)}>{ids.length ? `선택한 ${ids.length}명 듣기` : "선택 적용"}</button>
        <p aria-live="polite">{ids.length ? "패널을 닫아도 선택한 트랙이 계속 재생돼요" : "모두 해제하면 재생이 멈춰요"}</p>
      </footer>
    </section>
  </div>, target);
}

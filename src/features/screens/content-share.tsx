"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { contentLink } from "@/lib/api/content-link";
import type { SharedContent } from "@/lib/api/content-link";
import "./content-share.css";

export function ContentShareDialog({ content, onClose }: { content: SharedContent; onClose: () => void }) {
  const url = contentLink(content);
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    input.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했습니다.");
    } catch {
      input.current?.select();
      setMessage("링크를 선택했습니다. 복사해서 공유해 주세요.");
    }
  }

  const container = document.querySelector(".phone-frame") ?? document.body;
  return createPortal(<div className="content-share-layer">
    <button className="content-share-backdrop" aria-label="공유 창 닫기" onClick={onClose} />
    <section className="content-share-dialog" role="dialog" aria-modal="true" aria-label="콘텐츠 공유">
      <div className="content-share-heading"><h2>공유하기</h2><button aria-label="공유 창 닫기" onClick={onClose}>×</button></div>
      <p>{content.kind === "short" ? "숏폼" : "게시글"} 링크를 복사해 공유하세요.</p>
      <div className="content-share-url"><input ref={input} aria-label="공유 링크" value={url} readOnly onFocus={event => event.currentTarget.select()} /><button onClick={copy}>링크 복사</button></div>
      {message && <p className="content-share-message" role="status">{message}</p>}
    </section>
  </div>, container);
}

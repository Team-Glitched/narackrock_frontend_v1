"use client";
import { useState } from "react";
import { Asset } from "./shared";
/** V3 Comment / Report (12798:20046). */
export function ReportReasons() {
  const [selected, setSelected] = useState<number | null>(null);
  return <div className="comment-report-content"><h2>어떤 문제인가요?</h2><p>저희 나락락에서 최대한 빠른 시일 내에 처리해 드리겠습니다.</p><div className="comment-report-reasons" role="radiogroup" aria-label="신고 사유">{["성적인 콘텐츠", "폭력적 또는 혐오스러운 콘텐츠", "아무튼 문제", ...Array(7).fill("아무튼 대충 봤을 때 문제")].map((reason, index) => <button key={index} role="radio" aria-checked={selected === index} onClick={() => setSelected(index)}><span><Asset name="report-radio.svg" />{selected === index && <i />}</span>{reason}</button>)}</div></div>;
}

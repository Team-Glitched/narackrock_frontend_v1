"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * 목록 끝에 둔 감시용 요소가 보이면 다음 페이지를 부른다.
 *
 * `rootRef`를 받는 이유: 이 앱은 window가 아니라 `.scroll-content`(phone-frame 안의
 * `overflow-y:auto` 요소)가 스크롤된다. root를 지정하지 않으면 rootMargin이 뷰포트
 * 기준이 되어 "끝에 가까워졌다"는 판정이 화면 크기에 따라 달라진다.
 *
 * `rootMargin`으로 실제 끝에 닿기 전에 미리 부른다 — 바닥을 보고 나서 받기 시작하면
 * 빈 화면을 보는 시간이 생긴다.
 *
 * 감시는 `enabled`가 false면 아예 걸지 않는다. 더 받을 게 없거나 이미 받는 중일 때
 * 옵저버가 계속 살아 있으면 같은 페이지를 반복해서 부른다.
 */
export function useInfiniteScroll({ enabled, onLoadMore, rootRef, rootMargin = "200px" }: {
  enabled: boolean;
  onLoadMore: () => void;
  rootRef: RefObject<HTMLElement | null>;
  rootMargin?: string;
}): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // 콜백 신원이 바뀔 때마다 옵저버를 다시 걸지 않도록 최신 값만 담아 둔다.
  // 렌더 중에 ref를 쓰면 안 되므로(react-hooks/refs) 갱신도 effect에서 한다.
  const latest = useRef(onLoadMore);
  useEffect(() => { latest.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel) return;
    // 서버 렌더나 구형 환경에서는 조용히 쉰다 — 화면의 "더보기" 버튼이 대신 동작한다.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => { if (entries.some(entry => entry.isIntersecting)) latest.current(); },
      { root: rootRef.current, rootMargin },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, rootMargin, rootRef]);

  return sentinelRef;
}

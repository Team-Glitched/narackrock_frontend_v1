"use client";

import { useSyncExternalStore } from "react";
import { getCurrentUserId, subscribeCurrentUserId } from "@/lib/api/client";

// 로그인 사용자 id를 구독한다. 로그인 화면이 붙어 setCurrentUserId를 호출하면
// 이 훅을 쓰는 화면이 자동으로 다시 그려진다.
// 서버 렌더 시점에는 알 수 없으므로 비로그인(null)으로 본다.
export function useCurrentUserId(): number | null {
  return useSyncExternalStore(subscribeCurrentUserId, getCurrentUserId, () => null);
}

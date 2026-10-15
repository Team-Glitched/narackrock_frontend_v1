"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCurrentUserId } from '@/hooks/use-current-user';
import { moderationApi, type GalleryRole } from '@/lib/api/community-moderation';
import { ApiError } from '@/lib/api/client';

const GalleryPermission = createContext<{ role: GalleryRole | null; loading: boolean; error: string | null; reload: () => void }>({ role: null, loading: false, error: null, reload: () => {} });
export const useGalleryPermission = () => useContext(GalleryPermission);

export function GalleryPermissionProvider({ galleryId, children }: { galleryId: number; children: ReactNode }) {
  const userId = useCurrentUserId();
  return <PermissionSession key={`${userId}:${galleryId}`} galleryId={galleryId} userId={userId}>{children}</PermissionSession>;
}
function PermissionSession({ galleryId, userId, children }: { galleryId: number; userId: number | null; children: ReactNode }) {
  const [role, setRole] = useState<GalleryRole | null>(null);
  const [loading, setLoading] = useState(userId !== null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => { setRole(null); setLoading(true); setError(null); setRevision(n => n + 1); }, []);
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    moderationApi.role(galleryId).then(data => { if (active && data.galleryId === galleryId) setRole(data); })
      .catch(cause => { if (active) setError(moderationError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [galleryId, userId, revision]);
  return <GalleryPermission.Provider value={{ role, loading, error, reload }}>{children}</GalleryPermission.Provider>;
}

export function moderationError(cause: unknown): string {
  if (cause instanceof RangeError) return cause.message;
  if (cause instanceof ApiError) {
    if (cause.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    if (cause.status === 403) return cause.message || '이 작업을 수행할 권한이 없거나 제재할 수 없는 대상입니다.';
    if (cause.status === 404) return '대상이 없거나 삭제되었습니다. 목록을 새로고침해 주세요.';
    if (cause.status === 409) return `${cause.message} 목록을 확인한 뒤 다시 시도해 주세요.`;
    if (cause.status >= 500) return '서버 응답을 확인하지 못했습니다. 목록을 새로고침하여 처리 여부를 확인해 주세요.';
    return cause.message;
  }
  return '연결이 끊겼습니다. 목록을 새로고침하여 처리 여부를 확인한 뒤 다시 시도해 주세요.';
}

export function useCursorList<T>(load: (cursor: number | null) => Promise<{ items: T[]; nextCursor: number | null; hasNext: boolean }>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const lock = useRef(false);
  const refresh = useCallback(() => { generation.current++; lock.current = false; setItems([]); setCursor(null); setHasNext(false); setBusy(true); setError(null); setRevision(n => n + 1); }, []);
  useEffect(() => {
    const current = ++generation.current;
    lock.current = true;
    load(null).then(page => {
      if (generation.current === current) { setItems(page.items); setCursor(page.nextCursor); setHasNext(page.hasNext && page.nextCursor !== null); }
    }).catch(cause => { if (generation.current === current) setError(moderationError(cause)); })
      .finally(() => { if (generation.current === current) { setBusy(false); lock.current = false; } });
    return () => { if (generation.current === current) generation.current = current + 1; };
  }, [load, revision]);
  async function more() {
    if (lock.current || !hasNext || cursor === null) return;
    lock.current = true; setBusy(true); setError(null);
    const current = generation.current;
    try {
      const page = await load(cursor);
      if (current === generation.current) { setItems(old => [...old, ...page.items]); setCursor(page.nextCursor); setHasNext(page.hasNext && page.nextCursor !== null && page.nextCursor !== cursor); }
    } catch (cause) { if (current === generation.current) setError(moderationError(cause)); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  }
  return { items, busy, error, hasNext, more, refresh };
}

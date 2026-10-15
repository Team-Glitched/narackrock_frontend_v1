"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/app/shared';
import { ApiError } from '@/lib/api/client';
import { moderationApi, type SearchUser } from '@/lib/api/community-moderation';
import { Failure, GalleryForm, ModerationDialog, ReasonDialog, ListStatus, More } from './moderation-ui';
import { moderationError, useCursorList, useGalleryPermission } from './moderation-state';
import { serverTime } from './proposal-panel';
import { AdminPanel } from './service-admin-panel';

export function ManageEntry({ name, description, onChanged }: { name: string; description: string; onChanged: () => void }) {
  const permission = useGalleryPermission();
  const [open, setOpen] = useState(false);
  if (permission.loading) return <p className="moderation-meta" role="status">관리 권한 확인 중…</p>;
  if (permission.error) return <div className="moderation-entry"><button onClick={permission.reload}>관리 권한 다시 확인</button></div>;
  if (!permission.role?.canManage) return null;
  return <div className="moderation-entry"><button onClick={() => setOpen(true)}>⚒ 커뮤니티 관리</button>
    {open && <ModerationDialog title={name} description="커뮤니티 소개와 이용자를 관리합니다." onClose={() => setOpen(false)}><ManagePanel description={description} onChanged={onChanged} /></ModerationDialog>}
  </div>;
}
function ManagePanel({ description, onChanged }: { description: string; onChanged: () => void }) {
  const { role, reload } = useGalleryPermission();
  const [tab, setTab] = useState('intro');
  if (!role?.canManage) return null;
  const galleryId = role.galleryId;
  const tabs = [['intro', '소개'], ['users', '이용자'], ['bans', '제재 내역'], ['logs', '관리 이력'], ...(role.isAdmin ? [['admin', '서비스 관리']] : [])];
  return <><div className="moderation-tabs" aria-label="관리 메뉴">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'intro' && <GalleryForm editing initialDescription={description} onSubmit={async (_, text) => {
      try { await moderationApi.update(galleryId, text); onChanged(); }
      catch (cause) { if (cause instanceof ApiError && cause.status === 403) reload(); throw new Error(moderationError(cause)); }
    }} />}
    {tab === 'users' && <UserSearch galleryId={galleryId} />}
    {tab === 'bans' && <BanList galleryId={galleryId} />}
    {tab === 'logs' && <LogList galleryId={galleryId} />}
    {tab === 'admin' && role.isAdmin && <AdminPanel />}
  </>;
}
function UserSearch({ galleryId }: { galleryId: number }) {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ user: SearchUser; type: 'SUSPEND' | 'EXPEL' } | null>(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const lock = useRef(false);
  const { reload } = useGalleryPermission();
  useEffect(() => () => { generation.current++; }, []);
  async function search(append = false) {
    if (lock.current) return;
    const text = append ? query : keyword.trim();
    if (!text) return;
    lock.current = true; setBusy(true); setError(null); setNotice('');
    const current = ++generation.current;
    const nextPage = append ? page + 1 : 0;
    if (!append) { setUsers([]); setTotal(0); setQuery(text); }
    try {
      const result = await moderationApi.searchUsers(text, nextPage);
      if (current !== generation.current) return;
      setUsers(old => append ? [...old, ...result.users.filter(user => !old.some(item => item.userId === user.userId))] : result.users);
      setTotal(result.totalResultCount); setPage(nextPage);
    } catch (cause) { if (current === generation.current) setError(moderationError(cause)); }
    finally { if (current === generation.current) { setBusy(false); lock.current = false; } }
  }
  return <><p className="moderation-meta">서비스 전체 이용자를 검색합니다. 조치는 현재 커뮤니티에만 적용됩니다.</p>
    <form className="moderation-form" onSubmit={e => { e.preventDefault(); void search(); }}><label>이용자 검색<input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="닉네임 검색" required disabled={busy} /></label><button className="purple-pill" disabled={busy || !keyword.trim()}>검색</button></form>
    <Failure error={error} />{notice && <p role="status" className="moderation-notice">{notice}</p>}
    {busy && <p role="status">검색 중…</p>}{query && !busy && !error && !users.length && <p className="moderation-status">검색 결과가 없습니다.</p>}
    <ul className="moderation-list">{users.map(user => <li key={user.userId} className="moderation-card"><div className="moderation-user"><Avatar src={user.profileImageUrl} /><strong>{user.nickname}</strong></div><p>{user.primaryInstrument || '악기 미설정'} · #{user.userId}</p><div className="moderation-actions"><button className="gray-pill compact" onClick={() => setSelected({ user, type: 'SUSPEND' })}>이용정지</button><button className="gray-pill compact" onClick={() => setSelected({ user, type: 'EXPEL' })}>추방</button></div></li>)}</ul>
    {users.length > 0 && users.length < total && <button className="gray-pill" disabled={busy} onClick={() => void search(true)}>더 보기</button>}
    {selected && <ReasonDialog title={`${selected.user.nickname} ${selected.type === 'SUSPEND' ? '이용정지' : '추방'}`} description={selected.type === 'SUSPEND' ? '이 커뮤니티에서 글·댓글 작성과 반응이 제한됩니다.' : '이 커뮤니티의 구독이 해제되고 재구독과 활동이 제한됩니다. 열람은 유지됩니다.'} duration={selected.type === 'SUSPEND'} onClose={() => setSelected(null)} onSubmit={async (reason, days) => {
      try { await moderationApi.sanction(galleryId, selected.user.userId, selected.type, reason, days); setNotice('조치를 적용했습니다. 제재 내역에서 확인하거나 해제할 수 있습니다.'); }
      catch (cause) { if (cause instanceof ApiError && cause.errorCode === 'FORBIDDEN') reload(); throw new Error(moderationError(cause)); }
    }} />}
  </>;
}
function BanList({ galleryId }: { galleryId: number }) {
  const [activeOnly, setActiveOnly] = useState(true);
  return <><div className="moderation-tabs"><button aria-pressed={activeOnly} onClick={() => setActiveOnly(true)}>활성 제재</button><button aria-pressed={!activeOnly} onClick={() => setActiveOnly(false)}>전체 내역</button></div><BanResults key={String(activeOnly)} galleryId={galleryId} activeOnly={activeOnly} /></>;
}
function BanResults({ galleryId, activeOnly }: { galleryId: number; activeOnly: boolean }) {
  const load = useCallback(async (cursor: number | null) => { const page = await moderationApi.bans(galleryId, cursor, activeOnly); return { ...page, items: page.bans }; }, [galleryId, activeOnly]);
  const list = useCursorList(load);
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  return <><ListStatus list={list} /><Failure error={error} /><ul className="moderation-list">{list.items.map(ban => <li className="moderation-card" key={ban.banId}><h3>이용자 #{ban.userId} · {ban.banType === 'SUSPEND' ? '이용정지' : '추방'}</h3><p>{ban.reason}</p><span className="moderation-meta">{ban.active ? '적용 중' : '종료됨'} · {ban.bannedUntil ? `${serverTime(ban.bannedUntil)}까지` : '해제 전까지'}</span>{ban.active && <button className="gray-pill" disabled={busy} onClick={() => setPending(ban.banId)}>제재 해제</button>}</li>)}</ul><More list={list} />
    {pending !== null && <ModerationDialog title="제재를 해제할까요?" description="이 이용자가 다시 커뮤니티에서 활동할 수 있습니다." onClose={() => setPending(null)} busy={busy}><Failure error={error} /><div className="moderation-actions"><button className="gray-pill" disabled={busy} onClick={() => setPending(null)}>취소</button><button className="purple-pill" disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true); setError(null);
      try { await moderationApi.lift(galleryId, pending); setPending(null); list.refresh(); }
      catch (cause) { setError(moderationError(cause)); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? '해제 중…' : '해제'}</button></div></ModerationDialog>}
  </>;
}
function LogList({ galleryId }: { galleryId: number }) {
  const load = useCallback(async (cursor: number | null) => { const page = await moderationApi.logs(galleryId, cursor); return { ...page, items: page.logs }; }, [galleryId]);
  const list = useCursorList(load);
  const labels: Record<string, string> = { UPDATE_GALLERY: '소개 수정', SUSPEND_USER: '이용정지', EXPEL_USER: '추방', LIFT_BAN: '제재 해제', DELETE_POST: '게시글 삭제', DELETE_COMMENT: '댓글 삭제' };
  return <><ListStatus list={list} /><ul className="moderation-list">{list.items.map(log => <li className="moderation-card" key={log.logId}><h3>{labels[log.actionType] ?? log.actionType}</h3><p>{log.reason || '사유 없음'}</p><span className="moderation-meta">처리자 #{log.actorId}{log.targetUserId ? ` · 대상 이용자 #${log.targetUserId}` : ''}{log.targetId ? ` · 대상 #${log.targetId}` : ''}</span><time>{serverTime(log.createdAt)}</time></li>)}</ul><More list={list} /></>;
}

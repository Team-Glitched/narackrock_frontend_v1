"use client";

import { useCallback, useState } from 'react';
import { useCurrentUserId } from '@/hooks/use-current-user';
import { moderationApi } from '@/lib/api/community-moderation';
import { GalleryForm, Failure, ModerationDialog } from './moderation-ui';
import { moderationError, useCursorList } from './moderation-state';

export const statusLabel = { PENDING: '검토 중', APPROVED: '승인됨', REJECTED: '반려됨' };
// API uses LocalDateTime without an offset. Preserve its wall-clock value, do not invent a timezone.
export const serverTime = (value: string | null) => value ? `${value.replace('T', ' ').slice(0, 16)} (서버 기준)` : '—';

export function ProposalEntry({ onLogin }: { onLogin: () => void }) {
  const userId = useCurrentUserId();
  const [open, setOpen] = useState(false);
  return <div className="moderation-entry"><button onClick={() => userId === null ? onLogin() : setOpen(true)}>커뮤니티 개설 · 내 요청</button>
    {open && userId !== null && <ModerationDialog title="커뮤니티 개설" description="이야기를 나눌 공간을 제안해 주세요. 승인 후 운영자가 됩니다." onClose={() => setOpen(false)}><ProposalPanel key={userId} /></ModerationDialog>}
  </div>;
}
function ProposalPanel() {
  const [tab, setTab] = useState<'create' | 'mine'>('create');
  return <><div className="moderation-tabs"><button aria-pressed={tab === 'create'} onClick={() => setTab('create')}>개설 요청</button><button aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>내 요청</button></div>
    {tab === 'create' ? <GalleryForm onSubmit={async (name, description) => {
      try { await moderationApi.submit(name, description); } catch (cause) { throw new Error(moderationError(cause)); }
    }} /> : <MyProposals />}</>;
}
function MyProposals() {
  const load = useCallback(async () => ({ items: await moderationApi.mine(), nextCursor: null, hasNext: false }), []);
  const list = useCursorList(load);
  return <><button className="gray-pill compact" disabled={list.busy} onClick={list.refresh}>새로고침</button><Failure error={list.error} />
    {list.busy && <p role="status">요청을 불러오는 중…</p>}
    {!list.busy && !list.error && !list.items.length && <p className="moderation-status">아직 개설 요청이 없습니다.</p>}
    <ul className="moderation-list">{list.items.map(p => <li key={p.proposalId} className="moderation-card"><h3>{p.name}</h3><strong>{statusLabel[p.status]}</strong><p>{p.description}</p>{p.rejectionReason && <p>반려 사유: {p.rejectionReason}</p>}<time>{serverTime(p.createdAt)}</time></li>)}</ul></>;
}

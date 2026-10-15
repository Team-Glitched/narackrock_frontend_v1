"use client";

import { useCallback, useRef, useState } from 'react';
import { moderationApi, type Proposal, type Report, type ReportAction } from '@/lib/api/community-moderation';
import { Failure, ModerationDialog, ReasonDialog, ListStatus, More } from './moderation-ui';
import { moderationError, useCursorList, useGalleryPermission } from './moderation-state';
import { serverTime, statusLabel } from './proposal-panel';

export function AdminPanel() {
  const { role } = useGalleryPermission();
  const [tab, setTab] = useState('proposals');
  if (!role?.isAdmin || !role.canManage) return null;
  return <><p className="moderation-meta">서비스 전체 관리자 영역</p><div className="moderation-tabs"><button aria-pressed={tab === 'proposals'} onClick={() => setTab('proposals')}>개설 승인</button><button aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>신고 처리</button></div>{tab === 'proposals' ? <Proposals /> : <Reports />}</>;
}
function Proposals() {
  const [status, setStatus] = useState('PENDING');
  return <><div className="moderation-tabs">{Object.entries(statusLabel).map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div><ProposalResults key={status} status={status} /></>;
}
function ProposalResults({ status }: { status: string }) {
  const load = useCallback(async (cursor: number | null) => { const page = await moderationApi.proposals(status, cursor); return { ...page, items: page.proposals }; }, [status]);
  const list = useCursorList(load);
  const [selected, setSelected] = useState<{ proposal: Proposal; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  return <><ListStatus list={list} /><ul className="moderation-list">{list.items.map(p => <li className="moderation-card" key={p.proposalId}><h3>{p.name}</h3><p>{p.description}</p><span className="moderation-meta">요청자 #{p.proposerId} · {serverTime(p.createdAt)}</span>{p.rejectionReason && <p>반려 사유: {p.rejectionReason}</p>}{p.status === 'PENDING' && <div className="moderation-actions"><button className="gray-pill" onClick={() => setSelected({ proposal: p, approve: false })}>반려</button><button className="purple-pill" onClick={() => { setError(null); setSelected({ proposal: p, approve: true }); }}>승인</button></div>}</li>)}</ul><More list={list} />
    {selected && (selected.approve ? <ModerationDialog title="개설을 승인할까요?" description={`${selected.proposal.name} 커뮤니티를 만들고 요청자를 매니저로 지정합니다.`} onClose={() => setSelected(null)} busy={busy}><Failure error={error} /><div className="moderation-actions"><button className="gray-pill" disabled={busy} onClick={() => setSelected(null)}>취소</button><button className="purple-pill" disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true); setError(null);
      try { await moderationApi.approve(selected.proposal.proposalId); setSelected(null); list.refresh(); }
      catch (cause) { setError(moderationError(cause)); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? '승인 중…' : '승인'}</button></div></ModerationDialog> : <ReasonDialog title="개설 요청 반려" description={selected.proposal.name} onClose={() => setSelected(null)} onSubmit={async reason => {
      try { await moderationApi.reject(selected.proposal.proposalId, reason); list.refresh(); }
      catch (cause) { throw new Error(moderationError(cause)); }
    }} />)}
  </>;
}
function Reports() {
  const [status, setStatus] = useState('PENDING');
  return <><div className="moderation-tabs">{[['PENDING', '대기'], ['RESOLVED', '처리 완료'], ['REJECTED', '반려']].map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div><ReportResults key={status} status={status} /></>;
}
function ReportResults({ status }: { status: string }) {
  const load = useCallback(async (cursor: number | null) => { const page = await moderationApi.reports(status, cursor); return { ...page, items: page.content }; }, [status]);
  const list = useCursorList(load);
  const [selected, setSelected] = useState<{ report: Report; action: ReportAction | 'REJECT' } | null>(null);
  return <><ListStatus list={list} /><ul className="moderation-list">{list.items.map(report => <li className="moderation-card" key={report.reportId}><h3>신고 #{report.reportId} · {report.targetType}</h3><p>{report.contentSummary || '내용 없음'}</p><p>신고 사유: {report.reason}{report.description ? ` / ${report.description}` : ''}</p><span className="moderation-meta">대상 #{report.targetId} · {report.reportedUser?.nickname || '알 수 없는 작성자'} · {serverTime(report.reportedAt)}</span>{report.targetDeleted && <p>이미 삭제된 콘텐츠입니다.</p>}{status === 'PENDING' && <div className="moderation-actions">
      {report.targetType !== 'SHORT' && !report.targetDeleted && <button className="gray-pill" onClick={() => setSelected({ report, action: 'DELETE_CONTENT' })}>콘텐츠 삭제</button>}
      {report.reportedUser && <button className="gray-pill" onClick={() => setSelected({ report, action: 'BAN_USER' })}>서비스 이용정지</button>}
      <button className="gray-pill" onClick={() => setSelected({ report, action: 'WARN_USER' })}>경고 기록</button><button className="gray-pill" onClick={() => setSelected({ report, action: 'NONE' })}>조치 없이 완료</button><button className="gray-pill" onClick={() => setSelected({ report, action: 'REJECT' })}>반려</button>
    </div>}</li>)}</ul><More list={list} />
    {selected && <ReasonDialog title={selected.action === 'BAN_USER' ? '서비스 전체 이용정지' : selected.action === 'REJECT' ? '신고 반려' : '신고 처리'} description={selected.action === 'BAN_USER' ? '갤러리 제재와 달리 서비스 전체에 적용됩니다. 이번 화면에서는 기간제 정지만 지원합니다.' : selected.action === 'WARN_USER' ? '경고 이력만 남깁니다. 알림은 발송되지 않습니다.' : selected.action === 'DELETE_CONTENT' ? '신고 대상 콘텐츠가 삭제됩니다.' : '처리 사유를 기록합니다.'} duration={selected.action === 'BAN_USER'} onClose={() => setSelected(null)} onSubmit={async (reason, days) => {
      try {
        if (selected.action === 'REJECT') await moderationApi.rejectReport(selected.report.reportId, reason);
        else await moderationApi.resolveReport(selected.report.reportId, selected.action, reason, days);
        list.refresh();
      } catch (cause) { throw new Error(moderationError(cause)); }
    }} />}
  </>;
}

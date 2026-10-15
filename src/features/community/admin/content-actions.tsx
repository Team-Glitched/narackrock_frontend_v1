"use client";

import { useState } from 'react';
import { useCurrentUserId } from '@/hooks/use-current-user';
import { ApiError } from '@/lib/api/client';
import { moderationApi, type ContentKind } from '@/lib/api/community-moderation';
import { ReasonDialog } from './moderation-ui';
import { moderationError, useGalleryPermission } from './moderation-state';

export function ContentActions({ kind, contentId, onChanged }: { kind: ContentKind; contentId: number; onChanged: () => void }) {
  const userId = useCurrentUserId();
  const permission = useGalleryPermission();
  const [action, setAction] = useState<'report' | 'delete' | null>(null);
  const [notice, setNotice] = useState('');
  if (userId === null) return null;
  return <><div className="moderation-inline"><button onClick={() => { setNotice(''); setAction('report'); }}>신고</button>{permission.role?.canManage && <button onClick={() => { setNotice(''); setAction('delete'); }}>관리자 삭제</button>}</div>
    {notice && <p role="status" className="moderation-notice">{notice}</p>}
    {action && <ReasonDialog key={`${userId}:${contentId}:${action}`} title={action === 'report' ? '어떤 잘못을 했나요?' : `${kind === 'post' ? '게시글' : '댓글'}을 삭제할까요?`} description={action === 'report' ? '신고 사유를 적어 주세요. 관리자가 검토합니다.' : '커뮤니티 관리 권한으로 삭제하며 사유가 이력에 남습니다.'} onClose={() => setAction(null)} onSubmit={async reason => {
      try {
        if (action === 'report') { await moderationApi.report(kind, contentId, reason); setNotice('신고가 접수되었습니다.'); }
        else {
          if (!permission.role?.canManage) throw new ApiError(403, '관리 권한을 다시 확인해 주세요.');
          await moderationApi.deleteContent(permission.role.galleryId, kind, contentId, reason);
          onChanged();
        }
      } catch (cause) { if (cause instanceof ApiError && cause.status === 403 && action === 'delete') permission.reload(); throw new Error(moderationError(cause)); }
    }} />}
  </>;
}

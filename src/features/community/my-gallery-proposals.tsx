import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { getMyGalleryProposals, type MyGalleryProposal } from "@/lib/api/community";

const statusLabel = { PENDING: "검토 대기", APPROVED: "승인됨", REJECTED: "반려됨" } as const;

/** The signed-in user's community proposals (`GET /gallery-proposals/me`). */
export function MyGalleryProposals({ revision, submitted }: { revision: number; submitted: boolean }) {
  const userId = useCurrentUserId();
  const key = `${userId}:${revision}`;
  const [loaded, setLoaded] = useState<{ key: string; items: MyGalleryProposal[]; error?: string } | null>(null);
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    getMyGalleryProposals()
      .then((items) => {
        if (active) setLoaded({ key, items });
      })
      .catch(() => {
        if (active) setLoaded({ key, items: [], error: "내 개설 신청을 불러오지 못했습니다." });
      });
    return () => {
      active = false;
    };
  }, [key, userId]);
  const current = loaded?.key === key ? loaded : null;
  if (userId === null || !current) return null;
  return (
    <section className={sharedStyles.creationSaveStatus} aria-label="내 커뮤니티 개설 신청">
      {submitted && <p role="status">개설 신청이 접수되었습니다. 관리자 승인 후 커뮤니티가 만들어집니다.</p>}
      {current.error && <p role="alert">{current.error}</p>}
      {current.items.length > 0 && (
        <ul>
          {current.items.map((item) => (
            <li key={item.proposalId}>
              {item.name} · {statusLabel[item.status]}
              {item.rejectionReason ? ` · ${item.rejectionReason}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

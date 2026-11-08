import { sharedStyles } from "@/styles/shared.styles";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { myGalleryProposalsQuery } from "@/features/community/community-queries";

const statusLabel = { PENDING: "검토 대기", APPROVED: "승인됨", REJECTED: "반려됨" } as const;

/** The signed-in user's community proposals (`GET /gallery-proposals/me`). */
export function MyGalleryProposals({ submitted }: { submitted: boolean }) {
  const userId = useCurrentUserId();
  const { data: items, isError } = useQuery(myGalleryProposalsQuery(userId));
  if (userId === null || (!items && !isError)) return null;
  return (
    <section className={sharedStyles.creationSaveStatus} aria-label="내 커뮤니티 개설 신청">
      {submitted && <p role="status">개설 신청이 접수되었습니다. 관리자 승인 후 커뮤니티가 만들어집니다.</p>}
      {!items && <p role="alert">내 개설 신청을 불러오지 못했습니다.</p>}
      {items && items.length > 0 && (
        <ul>
          {items.map((item) => (
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

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { buttonVariants } from "@/styles/variants";
import { requestAge } from "./contribution-presentation";
import type { ContributionNotificationDto } from "@/lib/api/composition";

/** The current time, renewed every minute, for request ages ("3분 전"). */
export function useMinuteClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function RequestTime({ createdAt }: { createdAt: string }) {
  const now = useMinuteClock();
  return (
    <time dateTime={createdAt} className="shrink-0 text-caption text-app-muted">
      {requestAge(createdAt, now)}
    </time>
  );
}

type Decision = "APPROVED" | "REJECTED";
export function ContributionReviewActions({
  busy,
  onReview,
}: {
  busy: boolean;
  onReview: (decision: Decision) => void;
}) {
  return (
    <div className="mt-4 flex gap-2" role="group" aria-label="참여 요청 처리">
      <button
        type="button"
        className={buttonVariants({ tone: "primary" })}
        disabled={busy}
        onClick={() => onReview("APPROVED")}
      >
        수락
      </button>
      <button
        type="button"
        className={buttonVariants({ tone: "secondary" })}
        disabled={busy}
        onClick={() => onReview("REJECTED")}
      >
        거절
      </button>
      {busy && (
        <span role="status" className="self-center text-caption text-app-muted">
          처리 중...
        </span>
      )}
    </div>
  );
}

/** One request row shared by notifications and the received-request page. */
export function ContributionRequestCard({
  item,
  onOpenProject,
  onOpenDetails,
  onOpenProfile,
  children,
}: {
  item: ContributionNotificationDto;
  onOpenProject: (id: number, contributionId: number) => void;
  onOpenDetails?: () => void;
  onOpenProfile?: (id: number) => void;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-4">
      <span className="shrink-0 pt-1">
        <Avatar />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          {onOpenProfile ? (
            <button
              type="button"
              className="min-w-0 text-left text-label font-semibold [overflow-wrap:anywhere]"
              onClick={() => onOpenProfile(item.userId)}
            >
              {item.nickname || "알 수 없는 사용자"}
            </button>
          ) : (
            <strong className="min-w-0 text-label [overflow-wrap:anywhere]">
              {item.nickname || "알 수 없는 사용자"}
            </strong>
          )}
          <RequestTime createdAt={item.createdAt} />
        </div>
        <div className="mt-2 text-body leading-6 [overflow-wrap:anywhere]">
          <strong className="font-medium">{item.projectTitle}</strong>에 참여를 요청했어요.
        </div>
        {item.description?.trim() && (
          <div className="mt-2 whitespace-pre-wrap text-caption leading-5 text-app-muted [overflow-wrap:anywhere]">
            {item.description}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 text-app-primary-soft"
            onClick={() => onOpenProject(item.projectId, item.contributionId)}
          >
            전체 트랙 보기
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          {onOpenDetails && (
            <button type="button" className="min-h-9 text-app-muted" onClick={onOpenDetails}>
              상세 보기
            </button>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}

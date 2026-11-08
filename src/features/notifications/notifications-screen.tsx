import { badgeVariants, filterChipVariants, type BadgeStatus } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { profileStyles } from "@/styles/profile.styles";
import { useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { followRequestsQuery, useReviewFollowRequestMutation } from "@/features/social/social-queries";
import { contributionInboxQuery, useReviewContributionMutation } from "@/features/workspace/workspace-queries";
import { ApiError } from "@/lib/api/client";

const badge = (status: BadgeStatus) => badgeVariants({ status });

const notificationFilters = [
  { id: "all", label: "전체" },
  { id: "contribution", label: "참여 요청" },
  { id: "follow", label: "팔로우 요청" },
] as const;
type NotificationFilter = (typeof notificationFilters)[number]["id"];

function listStatus({ data, error, isFetching }: UseQueryResult<unknown>) {
  return data ? "ready" : error && !isFetching ? "error" : "loading";
}

/**
 * Actionable server notifications only: received contribution requests and follow requests. General history
 * and read/unread state have no backend contract, so nothing is assembled from local records.
 */
type NotificationProps = {
  onBack: () => void;
  onOpenProject: (id: number) => void;
  onOpenProfile: (id: number) => void;
};

export function NotificationsScreen(props: NotificationProps) {
  const userId = useCurrentUserId();
  return <ScopedNotificationsScreen key={userId ?? "guest"} {...props} signedIn={userId !== null} />;
}

function ScopedNotificationsScreen({ onBack, onOpenProject, onOpenProfile, signedIn }: NotificationProps & { signedIn: boolean }) {
  const userId = useCurrentUserId();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const panel = useRef<HTMLElement>(null);
  const contributionList = useQuery({ ...contributionInboxQuery(userId), enabled: signedIn });
  const followList = useQuery({ ...followRequestsQuery(userId), enabled: signedIn });
  const contributionReview = useReviewContributionMutation();
  const followReview = useReviewFollowRequestMutation();
  const busy = contributionReview.isPending || followReview.isPending;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  /** Runs one review at a time; the reviewed request leaves its list once the server confirmed it. */
  function act<T>(mutate: (variables: T, callbacks: { onSuccess: () => void; onError: (cause: Error) => void }) => void, variables: T, done: string) {
    if (busy) return;
    setError(null);
    setNotice(null);
    mutate(variables, {
      onSuccess: () => setNotice(done),
      onError: (cause) => setError(cause instanceof ApiError && cause.message ? cause.message : "요청을 처리하지 못했습니다."),
    });
  }
  const contributions = filter === "follow" ? [] : contributionList.data ?? [];
  const follows = filter === "contribution" ? [] : followList.data ?? [];
  const resultCount = contributions.length + follows.length;
  const shownLists = [
    { id: "contribution", label: "참여 요청", status: listStatus(contributionList), retry: () => void contributionList.refetch() },
    { id: "follow", label: "팔로우 요청", status: listStatus(followList), retry: () => void followList.refetch() },
  ].filter(({ id }) => filter === "all" || filter === id);
  const complete = shownLists.every(({ status }) => status === "ready");
  return (
    <div
      className={socialStyles.notificationOverlay}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onBack();
        }
        if (e.key !== "Tab" || !panel.current) return;
        const controls = [
          ...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled)"),
        ];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <button className={socialStyles.notificationBackdrop} aria-label="알림 닫기" onClick={onBack} />
      <section
        ref={panel}
        tabIndex={-1}
        className={socialStyles.notificationsScreen}
        role="dialog"
        aria-modal="true"
        aria-label="알림"
      >
        <button className={socialStyles.notificationGrip} aria-label="알림 닫기" onClick={onBack} />
        <div className={socialStyles.notificationScroll}>
          <h1 className={socialStyles.notificationTitle}>알림</h1>
          <div
            className={"scrollbar-none m-0 mb-2 flex w-full gap-[6px] overflow-x-auto px-[2px] pt-[3px] pb-[5px]"}
            role="group"
            aria-label="알림 종류"
          >
            {notificationFilters.map((option) => (
              <button
                className={filterChipVariants({ appearance: "filled", size: "standard" })}
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={(e) => {
                  setFilter(option.id);
                  e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p
            className={"m-0 mb-6 text-right text-caption leading-[18px] font-normal text-app-muted"}
            role="status"
            aria-live="polite"
          >
            {signedIn && (complete ? `${resultCount}개` : resultCount > 0 ? `확인된 알림 ${resultCount}개` : null)}
          </p>
          {!signedIn && <p>로그인 후 알림을 확인할 수 있습니다.</p>}
          {signedIn && shownLists.map(({ id, label, status, retry }) =>
            status === "loading" ? (
              <p key={id} role="status">{label}을 불러오는 중...</p>
            ) : status === "error" ? (
              <div key={id}>
                <p role="alert">{label}을 불러오지 못했습니다.</p>
                <button type="button" onClick={retry} aria-label={`${label} 다시 시도`}>다시 시도</button>
              </div>
            ) : null,
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <ul className={socialStyles.notificationEvents}>
            {contributions.map((item) => (
              <li key={`contribution:${item.contributionId}`}>
                <Avatar />
                <div>
                  <span className={badge("request")}>받은 참여 요청</span>
                  <button className={socialStyles.notificationEventCopy} onClick={() => onOpenProject(item.projectId)}>
                    <strong>{item.nickname}</strong>
                    <span>님이 {item.projectTitle}에 참여를 요청했습니다.</span>
                    {item.description && <small>{item.description}</small>}
                  </button>
                  <div className={socialStyles.notificationEventActions}>
                    {(["APPROVED", "REJECTED"] as const).map((decision) => (
                      <button
                        key={decision}
                        disabled={busy}
                        onClick={() =>
                          act(
                            contributionReview.mutate,
                            { projectId: item.projectId, contributionId: item.contributionId, status: decision },
                            decision === "APPROVED" ? "참여 요청을 승인했습니다." : "참여 요청을 반려했습니다.",
                          )
                        }
                      >
                        {decision === "APPROVED" ? "승인" : "반려"}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
            {follows.map((request) => (
              <li key={`follow:${request.requestId}`}>
                <Avatar src={request.profileImageUrl} />
                <div>
                  <span className={badge("pending")}>팔로우 요청</span>
                  <button className={socialStyles.notificationEventCopy} onClick={() => onOpenProfile(request.requesterId)}>
                    <strong>{request.nickname}</strong>
                    <span>님이 팔로우를 요청했습니다.</span>
                  </button>
                  <div className={socialStyles.notificationEventActions}>
                    {(["accept", "reject"] as const).map((decision) => (
                      <button
                        key={decision}
                        disabled={busy}
                        onClick={() =>
                          act(
                            followReview.mutate,
                            { requestId: request.requestId, decision },
                            decision === "accept" ? "팔로우 요청을 수락했습니다." : "팔로우 요청을 거절했습니다.",
                          )
                        }
                      >
                        {decision === "accept" ? "수락" : "거절"}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {signedIn && complete && resultCount === 0 && (
            <p className={profileStyles.profileListEmpty}>
              {filter === "all" ? "새로운 알림이 없습니다." : "선택한 종류의 알림이 없습니다."}
            </p>
          )}
          <p className={profileStyles.profileListEmpty}>
            보낸 요청의 결과, 지난 알림 기록과 읽음 표시는 현재 서버에서 지원하지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}

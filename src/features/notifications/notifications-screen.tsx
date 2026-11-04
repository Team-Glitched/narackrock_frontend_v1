import { badgeVariants, filterChipVariants, type BadgeStatus } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { profileStyles } from "@/styles/profile.styles";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError } from "@/lib/api/client";
import {
  getContributionInbox,
  reviewContribution,
  type ContributionNotificationDto,
} from "@/lib/api/composition";
import { getFollowRequests, reviewFollowRequest, type FollowRequest } from "@/lib/api/social";

const badge = (status: BadgeStatus) => badgeVariants({ status });

const notificationFilters = [
  { id: "all", label: "전체" },
  { id: "contribution", label: "참여 요청" },
  { id: "follow", label: "팔로우 요청" },
] as const;
type NotificationFilter = (typeof notificationFilters)[number]["id"];

type Loaded = {
  userId: number | null;
  contributions: ContributionNotificationDto[];
  follows: FollowRequest[];
  error?: string;
};

/**
 * Actionable server notifications only: received contribution requests and follow requests. General history
 * and read/unread state have no backend contract, so nothing is assembled from local records.
 */
export function NotificationsScreen({
  onBack,
  onOpenProject,
  onOpenProfile,
}: {
  onBack: () => void;
  onOpenProject: (id: number) => void;
  onOpenProfile: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const panel = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([getContributionInbox(), getFollowRequests()])
      .then(([contributions, follows]) => {
        if (active) setLoaded({ userId, contributions, follows });
      })
      .catch((cause) => {
        if (active)
          setLoaded({
            userId,
            contributions: [],
            follows: [],
            error:
              cause instanceof ApiError && cause.status === 401
                ? "로그인 후 알림을 확인할 수 있습니다."
                : "알림을 불러오지 못했습니다.",
          });
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const current = loaded?.userId === userId ? loaded : null;
  const loading = current === null;
  async function act(key: string, run: () => Promise<unknown>, done: string, update: () => void) {
    if (busy !== null) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await run();
      update();
      setNotice(done);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.message ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }
  const contributions = filter === "follow" ? [] : (current?.contributions ?? []);
  const follows = filter === "contribution" ? [] : (current?.follows ?? []);
  const resultCount = contributions.length + follows.length;
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
            {loading ? "불러오는 중" : `${resultCount}개`}
          </p>
          {loading && <p role="status">불러오는 중...</p>}
          {current?.error && <p role="alert">{current.error}</p>}
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
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `c${item.contributionId}`,
                            () => reviewContribution(item.projectId, item.contributionId, decision),
                            decision === "APPROVED" ? "참여 요청을 승인했습니다." : "참여 요청을 반려했습니다.",
                            () =>
                              setLoaded(
                                (old) =>
                                  old && {
                                    ...old,
                                    contributions: old.contributions.filter((x) => x.contributionId !== item.contributionId),
                                  },
                              ),
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
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `f${request.requestId}`,
                            () => reviewFollowRequest(request.requestId, decision),
                            decision === "accept" ? "팔로우 요청을 수락했습니다." : "팔로우 요청을 거절했습니다.",
                            () =>
                              setLoaded(
                                (old) => old && { ...old, follows: old.follows.filter((x) => x.requestId !== request.requestId) },
                              ),
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
          {!loading && resultCount === 0 && !current?.error && (
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

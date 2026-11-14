import { notificationError } from "./notification-error";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Bell, Check, Settings2, ArrowUpRight } from "lucide-react";
import {
  notificationCategories,
  type NotificationCategory,
  type ServiceNotification,
} from "@/lib/api/notifications";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants, filterChip, filterChipRow } from "@/styles/variants";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { RequestTime } from "@/features/workspace/contribution-request-card";
import { useReviewContributionMutation } from "@/features/workspace/workspace-queries";
import { useReviewFollowRequestMutation } from "@/features/social/social-queries";
import {
  notificationsQuery,
  unreadNotificationsQuery,
  useNotificationMutations,
} from "./notification-queries";
import {
  notificationGroups,
  notificationBody,
  type NotificationGroup,
} from "./notification-groups";
import { NotificationSettings } from "./notification-settings";

type NotificationProps = {
  onBack: () => void;
  onOpenProject: (projectId: number, contributionId: number) => void;
  onOpenProfile: (userId: number) => void;
  onNavigate: (path: string) => void;
};
const statusLabel: Record<string, string> = {
  APPROVED: "수락됨",
  REJECTED: "거절됨",
  CLOSED: "처리되었거나 취소된 요청",
};
export function NotificationsScreen(props: NotificationProps) {
  const userId = useCurrentUserId();
  return <NotificationInbox key={userId ?? "guest"} {...props} userId={userId} />;
}
function NotificationInbox({
  userId,
  onBack,
  onOpenProject,
  onOpenProfile,
  onNavigate,
}: NotificationProps & { userId: number | null }) {
  const [category, setCategory] = useState<NotificationCategory | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const list = useInfiniteQuery(notificationsQuery(userId, category, unreadOnly));
  const count = useQuery(unreadNotificationsQuery(userId));
  const { read, readAll, refresh } = useNotificationMutations();
  const contributionReview = useReviewContributionMutation();
  const followReview = useReviewFollowRequestMutation();
  const busy =
    read.isPending || readAll.isPending || contributionReview.isPending || followReview.isPending;
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const groups = useMemo(() => notificationGroups(items), [items]);
  const throughId = list.data?.pages[0]?.throughId;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  async function act(operation: () => Promise<unknown>, message?: string) {
    if (busy) return;
    setError(null);
    setNotice(null);
    try {
      await operation();
      if (message) setNotice(message);
    } catch (cause) {
      setError(notificationError(cause));
      await refresh();
    }
  }
  const mark = async (group: NotificationGroup) => {
    const ids = group.items.filter((n) => !n.readAt).map((n) => n.id);
    if (ids.length) await read.mutateAsync(ids);
  };
  function open(group: NotificationGroup) {
    void act(async () => {
      await mark(group);
      const item = group.first;
      if (!item.available || !item.path) return;
      if (item.category === "FOLLOW" && item.actorId) onOpenProfile(item.actorId);
      else if (item.path.startsWith("/") && !item.path.startsWith("//")) onNavigate(item.path);
    });
  }
  async function review(group: NotificationGroup, accept: boolean) {
    const item = group.first;
    if (item.requestId === null) return;
    await act(
      async () => {
        if (item.type === "CONTRIBUTION_CREATED" && item.projectId !== null) {
          await contributionReview.mutateAsync({
            projectId: item.projectId,
            contributionId: item.requestId!,
            status: accept ? "APPROVED" : "REJECTED",
          });
        } else if (item.type === "FOLLOW_REQUESTED") {
          await followReview.mutateAsync({
            requestId: item.requestId!,
            decision: accept ? "accept" : "reject",
          });
        }
        await mark(group);
        await refresh();
      },
      accept ? "요청을 수락했습니다." : "요청을 거절했습니다.",
    );
  }
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
          ...panel.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <button
        className={socialStyles.notificationBackdrop}
        aria-label="알림 닫기"
        onClick={onBack}
      />
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-title font-bold">알림</h1>
              {count.data && count.data.count > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-caption font-semibold text-red-300">
                  {count.data.count}
                </span>
              )}
            </div>
            {userId !== null && (
              <button
                type="button"
                aria-label="알림 수신 설정"
                aria-expanded={settings}
                onClick={() => setSettings(!settings)}
                className="grid size-10 place-items-center rounded-full bg-white/5"
              >
                <Settings2 size={18} />
              </button>
            )}
          </div>
          {userId === null ? (
            <p>로그인 후 알림을 확인할 수 있습니다.</p>
          ) : (
            <>
              {settings && <NotificationSettings userId={userId} />}
              <div
                className={`${filterChipRow} mb-3`}
                role="group"
                aria-label="알림 종류"
              >
                {([[null, "전체"], ...notificationCategories] as const).map(([id, label]) => (
                  <button
                    key={id ?? "all"}
                    type="button"
                    className={filterChip}
                    aria-pressed={category === id}
                    onClick={(e) => {
                      setCategory(id);
                      setError(null);
                      setNotice(null);
                      e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mb-5 flex items-center justify-between gap-2 text-body text-app-muted">
                <button
                  type="button"
                  className={filterChip}
                  aria-pressed={unreadOnly}
                  onClick={() => setUnreadOnly(!unreadOnly)}
                >
                  미확인만 보기
                </button>
                <button
                  type="button"
                  className="flex min-h-9 items-center gap-1"
                  disabled={busy || !throughId || count.data?.count === 0}
                  onClick={() =>
                    void act(() => readAll.mutateAsync(throughId!), "알림을 모두 읽었습니다.")
                  }
                >
                  <Check size={14} />
                  모두 읽음
                </button>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-red-500/10 p-3 text-body leading-5 text-red-300"
                >
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="mb-3 text-body text-app-muted">
                  {notice}
                </p>
              )}
              {list.isPending && (
                <p role="status" className="py-10 text-center text-body text-app-muted">
                  알림을 불러오는 중...
                </p>
              )}
              {list.isError && (
                <div role="alert" className="py-8 text-center">
                  <p className="mb-3 text-body text-app-muted">알림을 불러오지 못했습니다.</p>
                  <button
                    onClick={() => void list.refetch()}
                    className={buttonVariants({ tone: "secondary", size: "compact" })}
                  >
                    다시 시도
                  </button>
                </div>
              )}
              <ul className="m-0 list-none p-0" aria-label="알림 목록">
                {groups.map((group) => (
                  <NotificationRow
                    key={group.first.id}
                    group={group}
                    busy={busy}
                    onOpen={() => open(group)}
                    onRead={() => void act(() => mark(group))}
                    onReview={(accept) => void review(group, accept)}
                    onProject={() => {
                      if (group.first.projectId && group.first.requestId)
                        void act(async () => {
                          await mark(group);
                          onOpenProject(group.first.projectId!, group.first.requestId!);
                        });
                    }}
                  />
                ))}
              </ul>
              {list.isSuccess && groups.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-app-muted">
                  <Bell size={30} strokeWidth={1.5} />
                  <p className="text-body">
                    {unreadOnly
                      ? "미확인 알림이 없습니다."
                      : category
                        ? "선택한 종류의 알림이 없습니다."
                        : "새로운 알림이 없습니다."}
                  </p>
                </div>
              )}
              {list.hasNextPage && (
                <button
                  type="button"
                  className={buttonVariants({ tone: "secondary" })}
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  {list.isFetchingNextPage ? "불러오는 중..." : "이전 알림 더 보기"}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
function NotificationRow({
  group,
  busy,
  onOpen,
  onRead,
  onReview,
  onProject,
}: {
  group: NotificationGroup;
  busy: boolean;
  onOpen: () => void;
  onRead: () => void;
  onReview: (accept: boolean) => void;
  onProject: () => void;
}) {
  const item: ServiceNotification = group.first;
  const unread = group.items.some((n) => !n.readAt);
  const pending =
    item.available &&
    item.requestStatus === "PENDING" &&
    item.requestId !== null &&
    (item.type === "CONTRIBUTION_CREATED" || item.type === "FOLLOW_REQUESTED");
  return (
    <li
      className={`mb-3 rounded-2xl border p-4 ${unread ? "border-violet-400/20 bg-violet-400/[0.06]" : "border-white/[0.06] bg-white/[0.015]"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-label font-semibold text-app-fg">
          {unread && (
            <span aria-label="미확인" className="size-1.5 shrink-0 rounded-full bg-red-400" />
          )}
          {item.title}
          {group.items.length > 1 && <span>{group.items.length}명</span>}
        </span>
        <RequestTime createdAt={item.createdAt} />
      </div>
      <button
        type="button"
        className="block w-full whitespace-pre-wrap break-words text-left text-body leading-6"
        disabled={busy}
        onClick={onOpen}
      >
        {notificationBody(group)}
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-body">
        {pending && item.type === "CONTRIBUTION_CREATED" ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 text-app-primary-soft"
            disabled={busy}
            onClick={onProject}
          >
            전체 트랙 보기
            <ArrowUpRight size={14} />
          </button>
        ) : item.path && item.available ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 text-app-primary-soft"
            disabled={busy}
            onClick={onOpen}
          >
            자세히 보기
            <ArrowUpRight size={14} />
          </button>
        ) : (
          <span />
        )}
        {unread && (
          <button type="button" className="min-h-9 text-app-muted" disabled={busy} onClick={onRead}>
            읽음 표시
          </button>
        )}
      </div>
      {pending ? (
        <div className="mt-2 flex gap-2" role="group" aria-label="요청 처리">
          <button
            type="button"
            disabled={busy}
            className={buttonVariants({ tone: "primary", size: "compact" })}
            onClick={() => onReview(true)}
          >
            수락
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            onClick={() => onReview(false)}
          >
            거절
          </button>
        </div>
      ) : (
        item.requestStatus && (
          <p className="mt-2 text-body text-app-muted">
            {statusLabel[item.requestStatus] ?? "처리 완료"}
          </p>
        )
      )}
    </li>
  );
}

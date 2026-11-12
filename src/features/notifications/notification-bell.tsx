import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { Asset } from "@/components/asset";
import { UnreadBadge } from "@/components/unread-badge";
import { cn } from "@/lib/utils";
import { unreadNotificationsQuery } from "./notification-queries";
export function NotificationBell({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const user = useCurrentUserId();
  const { data } = useQuery(unreadNotificationsQuery(user));
  const count = user === null ? 0 : (data?.count ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative", className)}
      aria-label={count ? `알림, 미확인 ${count}개` : "알림"}
    >
      <Asset name="v3-bell.svg" />
      <UnreadBadge count={count} />
    </button>
  );
}

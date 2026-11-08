import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { Asset } from "@/components/asset";
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
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-[#18181c]"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

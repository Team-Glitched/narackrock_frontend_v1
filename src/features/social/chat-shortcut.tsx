import { useQuery } from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { UnreadBadge } from "@/components/unread-badge";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { cn } from "@/lib/utils";
import { unreadChatQuery } from "./chat-queries";

export function ChatShortcut({ onClick, className }: { onClick: () => void; className: string }) {
  const userId = useCurrentUserId();
  const { data } = useQuery(unreadChatQuery(userId));
  const count = data?.count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative", className)}
      aria-label={count > 0 ? `대화 목록, 읽지 않은 메시지 ${count}개` : "대화 목록"}
    >
      <Asset name="v3-chat.svg" />
      <UnreadBadge count={count} />
    </button>
  );
}

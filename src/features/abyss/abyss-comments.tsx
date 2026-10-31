import { FigmaSheet } from "@/components/app/figma-sheet";
import type { Navigate } from "@/features/navigation/types";
export function AbyssComments({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  go: Navigate;
  commentCount?: number;
  shortId?: number;
  onCreated?: () => void;
}) {
  if (!open) return null;
  return (
    <FigmaSheet title="댓글" onClose={onClose}>
      <p role="status">현재 숏폼 댓글을 사용할 수 없습니다.</p>
    </FigmaSheet>
  );
}

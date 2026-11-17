import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { canSanction, type ModerationScope } from "@/features/community/use-gallery-role";
import { sanctionGalleryMember } from "@/lib/api/community";
import { ApiError } from "@/lib/api/client";
import { adminKeys } from "./admin-queries";
import { MemberActionDialog } from "./member-action-dialog";

/** Suspends (with a duration) or expels a gallery member through `POST /galleries/{id}/manage/bans`. */
export function PostMemberModeration({
  community,
  member,
  action,
  onClose,
  onDone,
}: {
  community: ModerationScope;
  member: { userId: number; nickname: string };
  action: "suspend" | "expel";
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const sanction = useMutation({
    mutationFn: ({ reason, days }: { reason: string; days: number }) =>
      sanctionGalleryMember(community.galleryId, {
        userId: member.userId,
        type: action === "suspend" ? "SUSPEND" : "EXPEL",
        durationDays: action === "suspend" ? days : null,
        reason,
      }),
    // The gallery's ban list and moderation log both record the sanction.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.gallery(userId, community.galleryId) }),
  });
  return (
    <MemberActionDialog
      member={member}
      action={action}
      onClose={onClose}
      onConfirm={async (reason, days) => {
        if (!canSanction(community, userId, member.userId))
          throw new Error("이 커뮤니티의 커뮤니티 어드민만 멤버를 제재할 수 있습니다.");
        try {
          await sanction.mutateAsync({ reason, days });
        } catch (cause) {
          throw new Error(cause instanceof ApiError ? cause.message : "제재를 적용하지 못했습니다.");
        }
        onDone(`${member.nickname} 님을 ${action === "suspend" ? `${days}일 이용정지했습니다.` : "추방했습니다."}`);
      }}
    />
  );
}

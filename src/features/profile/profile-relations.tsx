import { useLoginPrompt } from "@/features/auth/login-prompt";
import { buttonVariants } from "@/styles/variants";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import type { UserProfile } from "@/lib/api/contracts";
import { updateProfilePrivacy } from "@/lib/api/social";
import { canSendChatTo } from "@/features/social/chat-access";
import { outgoingRequestsQuery, useFollowMutation } from "@/features/social/social-queries";
import { profileKeys } from "./profile-queries";

export function relationError(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) return cause.status === 401 ? "로그인 후 이용할 수 있습니다." : cause.message || fallback;
  return cause instanceof TypeError ? "서버에 연결하지 못했습니다." : fallback;
}

/**
 * Follow / pending request / unfollow and chat entry for another user's profile. A private target's follow
 * becomes a pending request, never an immediate follow; relation queries are refetched after every change.
 */
export function ProfileRelationActions({ profile, onChat }: { profile: UserProfile; onChat: (userId: number) => void }) {
  const userId = useCurrentUserId();
  const { requireLogin } = useLoginPrompt();
  const authenticated = userId !== null;
  const outgoingQuery = useQuery({ ...outgoingRequestsQuery(userId), enabled: authenticated });
  const follow = useFollowMutation();
  const [notice, setNotice] = useState("");
  const outgoing = outgoingQuery.isError ? undefined : outgoingQuery.data;
  const outgoingError = outgoingQuery.isError && !outgoingQuery.isFetching
    ? relationError(outgoingQuery.error, "보낸 팔로우 요청을 확인하지 못했습니다.") : "";
  const known = outgoing !== undefined;
  const pending = outgoing?.some((request) => request.targetId === profile.userId) ?? false;
  const state = profile.relations.isFollowing ? "FOLLOWING" : pending ? "PENDING" : null;
  const busy = follow.isPending;
  function change() {
    if (!requireLogin() || busy || !known) return;
    setNotice("");
    follow.mutate({ targetId: profile.userId, state }, {
      onSuccess: ({ status }) => setNotice(state === "PENDING" ? "팔로우 요청을 취소했습니다." : status === "PENDING" ? "비공개 계정이라 상대가 수락하면 팔로우됩니다." : ""),
      onError: (cause) => setNotice(relationError(cause, "팔로우 상태를 바꾸지 못했습니다.")),
    });
  }
  const label = !authenticated ? "팔로우" : !known ? outgoingError ? "확인 실패" : "확인 중" : state === "FOLLOWING" ? "팔로잉" : state === "PENDING" ? "요청됨" : profile.relations.isFollowedBy ? "맞팔로우" : "팔로우";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button className={buttonVariants({ tone: state ? "secondary" : "primary" })} disabled={busy || (authenticated && !known)} aria-pressed={known ? state !== null : undefined} onClick={change}>
        {label}
      </button>
      {outgoingError && <div role="alert"><p>{outgoingError}</p><button onClick={() => void outgoingQuery.refetch()}>다시 확인</button></div>}
      {canSendChatTo(profile) && (
        <button className={buttonVariants({ tone: "secondary" })} onClick={() => { if (requireLogin(`/chat?userId=${profile.userId}`)) onChat(profile.userId); }}>
          채팅
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

/** Account privacy for the signed-in user; applied immediately with `PATCH /users/me/profile/privacy`. */
export function ProfilePrivacyToggle({ isPrivate }: { isPrivate: boolean }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const privacy = useMutation({
    mutationFn: updateProfilePrivacy,
    onSuccess: (result) => {
      if (userId === null) return;
      queryClient.setQueryData<UserProfile>(profileKeys.detail(userId, userId), (profile) => profile && { ...profile, isPrivate: result.isPrivate });
    },
  });
  return (
    <label className="flex items-center justify-between gap-3 px-5 py-3 text-body">
      <span>
        비공개 계정
        <small className="block text-caption text-app-muted">켜면 팔로우는 승인 후에만 이뤄지고 관계 목록이 숨겨집니다.</small>
        {privacy.isError && <small role="alert" className="block text-caption">{relationError(privacy.error, "공개 설정을 바꾸지 못했습니다.")}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={isPrivate}
        disabled={privacy.isPending}
        onChange={(event) => privacy.mutate(event.target.checked)}
      />
    </label>
  );
}

import { buttonVariants } from "@/styles/variants";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api/contracts";
import { followPerson, getOutgoingFollowRequests, unfollowPerson, updateProfilePrivacy } from "@/lib/api/social";
import { canSendChatTo } from "@/features/social/chat-access";

export function relationError(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) return cause.status === 401 ? "로그인 후 이용할 수 있습니다." : cause.message || fallback;
  return cause instanceof TypeError ? "서버에 연결하지 못했습니다." : fallback;
}

/**
 * Follow / pending request / unfollow and chat entry for another user's profile. A private target's follow
 * becomes a pending request, never an immediate follow; the profile is re-read after every change.
 */
export function ProfileRelationActions({
  profile,
  onChanged,
  onChat,
}: {
  profile: UserProfile;
  onChanged: () => void;
  onChat: (userId: number) => void;
}) {
  const [pending, setPending] = useState<{ userId: number; value: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    getOutgoingFollowRequests()
      .then((requests) => {
        if (active) setPending({ userId: profile.userId, value: requests.some((request) => request.targetId === profile.userId) });
      })
      .catch(() => {
        if (active) setPending({ userId: profile.userId, value: false });
      });
    return () => {
      active = false;
    };
  }, [profile.userId]);
  const requested = pending?.userId === profile.userId && pending.value;
  async function change() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (profile.relations.isFollowing || requested) {
        await unfollowPerson(profile.userId);
        setPending({ userId: profile.userId, value: false });
        setNotice(requested ? "팔로우 요청을 취소했습니다." : "");
      } else {
        const result = await followPerson(profile.userId);
        const waiting = result.status === "PENDING";
        setPending({ userId: profile.userId, value: waiting });
        if (waiting) setNotice("비공개 계정이라 상대가 수락하면 팔로우됩니다.");
      }
      onChanged();
    } catch (cause) {
      setNotice(relationError(cause, "팔로우 상태를 바꾸지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }
  const label = profile.relations.isFollowing ? "팔로잉" : requested ? "요청됨" : profile.relations.isFollowedBy ? "맞팔로우" : "팔로우";
  return (
    <div className="flex items-center justify-center gap-2">
      <button className={buttonVariants({ tone: profile.relations.isFollowing || requested ? "secondary" : "primary" })} disabled={busy || pending === null} aria-pressed={profile.relations.isFollowing || requested} onClick={() => void change()}>
        {label}
      </button>
      {canSendChatTo(profile) && (
        <button className={buttonVariants({ tone: "secondary" })} onClick={() => onChat(profile.userId)}>
          채팅
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

/** Account privacy for the signed-in user; applied immediately with `PATCH /users/me/profile/privacy`. */
export function ProfilePrivacyToggle({ isPrivate, onChanged }: { isPrivate: boolean; onChanged: (value: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <label className="flex items-center justify-between gap-3 px-5 py-3 text-body">
      <span>
        비공개 계정
        <small className="block text-caption text-app-muted">켜면 팔로우는 승인 후에만 이뤄지고 관계 목록이 숨겨집니다.</small>
        {error && <small role="alert" className="block text-caption">{error}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={isPrivate}
        disabled={busy}
        onChange={async (event) => {
          const next = event.target.checked;
          setBusy(true);
          setError("");
          try {
            onChanged((await updateProfilePrivacy(next)).isPrivate);
          } catch (cause) {
            setError(relationError(cause, "공개 설정을 바꾸지 못했습니다."));
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

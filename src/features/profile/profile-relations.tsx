import { buttonVariants } from "@/styles/variants";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiOrigin } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";
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
  const userId = useCurrentUserId();
  return <ScopedProfileRelationActions key={JSON.stringify([apiOrigin(), userId, profile.userId])} profile={profile} onChanged={onChanged} onChat={onChat} authenticated={userId !== null} />;
}

function ScopedProfileRelationActions({ profile, onChanged, onChat, authenticated }: { profile: UserProfile; onChanged: () => void; onChat: (userId: number) => void; authenticated: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [override, setOverride] = useState<"FOLLOWING" | "PENDING" | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [outgoingError, setOutgoingError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const counter = generation;
    const epoch = ++counter.current;
    if (!authenticated) return;
    getOutgoingFollowRequests()
      .then((requests) => {
        if (counter.current === epoch) setPending(requests.some((request) => request.targetId === profile.userId));
      })
      .catch((cause) => {
        if (counter.current === epoch) setOutgoingError(relationError(cause, "보낸 팔로우 요청을 확인하지 못했습니다."));
      });
    return () => { counter.current++; };
  }, [authenticated, profile.userId, revision]);
  const state = override !== undefined ? override : profile.relations.isFollowing ? "FOLLOWING" : pending ? "PENDING" : null;
  const known = pending !== null;
  async function change() {
    if (busy || !known) return;
    const epoch = generation.current;
    setBusy(true);
    setNotice("");
    try {
      if (state) {
        await unfollowPerson(profile.userId);
        if (generation.current !== epoch) return;
        setPending(false);
        setOverride(null);
        setNotice(state === "PENDING" ? "팔로우 요청을 취소했습니다." : "");
      } else {
        const result = await followPerson(profile.userId);
        if (generation.current !== epoch) return;
        setOverride(result.status);
        setPending(result.status === "PENDING");
        if (result.status === "PENDING") setNotice("비공개 계정이라 상대가 수락하면 팔로우됩니다.");
      }
      onChanged();
    } catch (cause) {
      if (generation.current === epoch) setNotice(relationError(cause, "팔로우 상태를 바꾸지 못했습니다."));
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }
  const label = !authenticated ? "로그인 필요" : !known ? outgoingError ? "확인 실패" : "확인 중" : state === "FOLLOWING" ? "팔로잉" : state === "PENDING" ? "요청됨" : profile.relations.isFollowedBy ? "맞팔로우" : "팔로우";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button className={buttonVariants({ tone: state ? "secondary" : "primary" })} disabled={busy || !known} aria-pressed={known ? state !== null : undefined} onClick={() => void change()}>
        {label}
      </button>
      {outgoingError && <div role="alert"><p>{outgoingError}</p><button onClick={() => { setPending(null); setOutgoingError(""); setRevision((value) => value + 1); }}>다시 확인</button></div>}
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

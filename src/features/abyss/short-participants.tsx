import { sharedStyles } from "@/styles/shared.styles";
import { abyssStyles } from "@/styles/abyss.styles";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError, apiOrigin } from "@/lib/api/client";
import type { ShortItemDto } from "@/lib/api/contracts";
import { getShortComposers, type ShortComposer } from "@/lib/api/shorts";
import { participantOwners, toggleOwner } from "./short-playback-state";
import type { ShortPlayback } from "./use-short-playback";

/**
 * Composer list and owner selection. The sheet edits `playback.draft`; the parent applies it on every close path
 * (`onClose`), so the chosen owners keep playing after the sheet closes.
 */
export function ShortParticipants({
  short,
  playback,
  onClose,
  onListenAll,
}: {
  short: ShortItemDto;
  playback: ShortPlayback;
  onClose: () => void;
  onListenAll: () => void;
}) {
  const userId = useCurrentUserId();
  const key = JSON.stringify([apiOrigin(), userId, short.shortId]);
  const [composers, setComposers] = useState<{ key: string; items?: ShortComposer[]; error?: string } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    getShortComposers(short.shortId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setComposers({ key, items });
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setComposers({
          key,
          error: cause instanceof ApiError && cause.status === 403
            ? "참여자 정보를 볼 권한이 없습니다." : "참여자 정보를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [key, reload, short.shortId, userId]);

  if (userId === null)
    return (
      <ul className={sharedStyles.participantList}>
        {short.participants.length ? (
          short.participants.map((person) => (
            <li key={person.userId}>
              <Avatar />
              <span>
                <strong>{person.nickname}</strong>
                <small>{person.userId === short.author.userId ? "원곡자" : "작곡 참여자"}</small>
              </span>
            </li>
          ))
        ) : (
          <li>아직 참여자가 없습니다.</li>
        )}
        <li>참여자별 트랙 듣기는 로그인 후 사용할 수 있습니다.</li>
      </ul>
    );

  const metadata = composers?.key === key ? composers : null;
  const { stems, draft } = playback;
  const tracks = stems.status === "ready" ? stems.data.tracks : [];
  const owners = participantOwners(metadata?.items ?? [], tracks, [short.author, ...short.participants]);
  const ownerIds = owners.map((owner) => owner.userId);
  const selectable = stems.status === "ready";
  const checkedCount = draft === null ? ownerIds.length : ownerIds.filter((id) => draft.has(id)).length;
  return (
    <div className={abyssStyles.participantSelection}>
      <div className={abyssStyles.participantSelectionActions} role="group" aria-label="참여자 선택">
        <button disabled={!selectable} onClick={() => playback.setDraft(null)}>전체 선택</button>
        <button disabled={!selectable} onClick={() => playback.setDraft(new Set())}>해제</button>
        <button onClick={onListenAll}>전체 듣기</button>
        <button onClick={onClose}>확인</button>
      </div>
      {stems.status === "error" ? (
        <p className={abyssStyles.participantSelectionStatus} role="alert">
          {stems.error} <button onClick={playback.retryStems}>다시 시도</button>
        </p>
      ) : (
        <p className={abyssStyles.participantSelectionStatus} role="status">
          {stems.status !== "ready" ? "참여자 트랙을 불러오는 중..."
            : draft === null ? "원곡 전체를 재생합니다."
            : `${checkedCount}명의 트랙만 재생합니다.`}
        </p>
      )}
      {!metadata && <p className={abyssStyles.participantSelectionStatus} role="status">참여자 정보를 불러오는 중...</p>}
      {metadata?.error && (
        <p className={abyssStyles.participantSelectionStatus} role="alert">
          {metadata.error} <button onClick={() => setReload((value) => value + 1)}>다시 시도</button>
        </p>
      )}
      <ul className={sharedStyles.participantList}>
        {owners.map((owner) => {
          const role = owner.userId === short.author.userId ? "원곡자" : "작곡 참여자";
          return (
            <li key={owner.userId}>
              <Avatar src={owner.profileImageUrl} />
              <span>
                <strong>{owner.nickname}</strong>
                <small>{[role, ...owner.roles, ...owner.trackNames].join(" · ")}</small>
              </span>
              <input
                type="checkbox"
                className={abyssStyles.participantCheck}
                aria-label={`${owner.nickname} 트랙 듣기`}
                checked={draft === null || draft.has(owner.userId)}
                disabled={!selectable}
                onChange={() => playback.setDraft(toggleOwner(draft, owner.userId, ownerIds))}
              />
            </li>
          );
        })}
        {metadata?.items && stems.status !== "loading" && owners.length === 0 && <li>아직 참여자가 없습니다.</li>}
      </ul>
    </div>
  );
}

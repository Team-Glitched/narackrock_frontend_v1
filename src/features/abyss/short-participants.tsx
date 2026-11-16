import { useLoginPrompt } from "@/features/auth/login-prompt";
import { sharedStyles } from "@/styles/shared.styles";
import { abyssStyles } from "@/styles/abyss.styles";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError } from "@/lib/api/client";
import type { ShortItemDto } from "@/lib/api/contracts";
import { shortComposersQuery } from "./abyss-queries";
import { participantOwners, toggleOwner, type ParticipantOwner } from "./short-playback-state";
import type { ShortPlayback } from "./use-short-playback";

/** "원곡자" for the short's author, otherwise "작곡 참여자". */
export const participantRole = (short: ShortItemDto, userId: number) =>
  userId === short.author.userId ? "원곡자" : "작곡 참여자";

export type ShortParticipantsState = {
  userId: number | null;
  composers: UseQueryResult<unknown>;
  composersError: string | null;
  /** Composers and stem owners, with their role/track line and whether the draft plays them. */
  owners: (ParticipantOwner & { detail: string; checked: boolean })[];
  /** The stems loaded: the owner selection can change. */
  selectable: boolean;
  /** The stems line: loading, the draft's selection, or the stems error. */
  stemsText: string;
  /** "아직 참여자가 없습니다." */
  empty: boolean;
  toggle: (ownerId: number) => void;
};

/** The participant sheet's data for a signed-in listener (web ShortParticipants and the app's sheet). */
export function useShortParticipants(
  short: ShortItemDto,
  playback: ShortPlayback,
): ShortParticipantsState {
  const userId = useCurrentUserId();
  const composers = useQuery({
    ...shortComposersQuery(userId, short.shortId),
    enabled: userId !== null,
  });
  const composersError = composers.isError
    ? composers.error instanceof ApiError && composers.error.status === 403
      ? "참여자 정보를 볼 권한이 없습니다."
      : "참여자 정보를 불러오지 못했습니다."
    : null;
  const { stems, draft } = playback;
  const tracks = stems.status === "ready" ? stems.data.tracks : [];
  const owners = participantOwners(composers.data ?? [], tracks, [
    short.author,
    ...short.participants,
  ]);
  const ownerIds = owners.map((owner) => owner.userId);
  const checkedCount =
    draft === null ? ownerIds.length : ownerIds.filter((id) => draft.has(id)).length;
  return {
    userId,
    composers,
    composersError,
    owners: owners.map((owner) => ({
      ...owner,
      detail: [participantRole(short, owner.userId), ...owner.roles, ...owner.trackNames].join(
        " · ",
      ),
      checked: draft === null || draft.has(owner.userId),
    })),
    selectable: stems.status === "ready",
    stemsText:
      stems.status === "error"
        ? stems.error
        : stems.status !== "ready"
          ? "참여자 트랙을 불러오는 중..."
          : draft === null
            ? "원곡 전체를 재생합니다."
            : `${checkedCount}명의 트랙만 재생합니다.`,
    empty: composers.data !== undefined && stems.status !== "loading" && owners.length === 0,
    toggle: (ownerId) => playback.setDraft(toggleOwner(draft, ownerId, ownerIds)),
  };
}

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
  const { requestLogin } = useLoginPrompt();
  const { userId, composers, composersError, owners, selectable, stemsText, empty, toggle } =
    useShortParticipants(short, playback);

  if (userId === null)
    return (
      <ul className={sharedStyles.participantList}>
        {short.participants.length ? (
          short.participants.map((person) => (
            <li key={person.userId}>
              <Avatar />
              <span>
                <strong>{person.nickname}</strong>
                <small>{participantRole(short, person.userId)}</small>
              </span>
            </li>
          ))
        ) : (
          <li>아직 참여자가 없습니다.</li>
        )}
        <li>
          <button onClick={() => requestLogin()}>로그인하고 참여자별 트랙 듣기</button>
        </li>
      </ul>
    );

  return (
    <div className={abyssStyles.participantSelection}>
      <div
        className={abyssStyles.participantSelectionActions}
        role="group"
        aria-label="참여자 선택"
      >
        <button disabled={!selectable} onClick={() => playback.setDraft(null)}>
          전체 선택
        </button>
        <button disabled={!selectable} onClick={() => playback.setDraft(new Set())}>
          해제
        </button>
        <button onClick={onListenAll}>전체 듣기</button>
        <button onClick={onClose}>확인</button>
      </div>
      {playback.stems.status === "error" ? (
        <p className={abyssStyles.participantSelectionStatus} role="alert">
          {stemsText} <button onClick={playback.retryStems}>다시 시도</button>
        </p>
      ) : (
        <p className={abyssStyles.participantSelectionStatus} role="status">
          {stemsText}
        </p>
      )}
      {composers.isPending && (
        <p className={abyssStyles.participantSelectionStatus} role="status">
          참여자 정보를 불러오는 중...
        </p>
      )}
      {composersError && (
        <p className={abyssStyles.participantSelectionStatus} role="alert">
          {composersError} <button onClick={() => void composers.refetch()}>다시 시도</button>
        </p>
      )}
      <ul className={sharedStyles.participantList}>
        {owners.map((owner) => (
          <li key={owner.userId}>
            <Avatar src={owner.profileImageUrl} />
            <span>
              <strong>{owner.nickname}</strong>
              <small>{owner.detail}</small>
            </span>
            <input
              type="checkbox"
              className={abyssStyles.participantCheck}
              aria-label={`${owner.nickname} 트랙 듣기`}
              checked={owner.checked}
              disabled={!selectable}
              onChange={() => toggle(owner.userId)}
            />
          </li>
        ))}
        {empty && <li>아직 참여자가 없습니다.</li>}
      </ul>
    </div>
  );
}

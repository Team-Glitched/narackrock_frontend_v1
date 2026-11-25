import { sharedStyles } from "@/styles/shared.styles";
import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { CanvasDialog } from "@/components/canvas-dialog";
import { DialogNumberInput } from "@/features/composition/dialog-number-input";
import { partLabel } from "@/features/composition/instrument-parts";
import { buttonVariants } from "@/styles/variants";
import { useId } from "react";
import type { TrackDto } from "@/lib/api/composition";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { profileQuery } from "@/features/profile/profile-queries";

/**
 * The track owner's shown name and picture. Older API deployments omit ownerNickname, so this
 * resolves only that owner, reusing the same account-scoped profile cache as the profile screen.
 * `retry` is set when that lookup failed ("사용자 이름 다시 불러오기").
 */
export function useTrackOwner(
  track: Pick<TrackDto, "ownerId" | "ownerNickname" | "ownerProfileImageUrl"> | undefined,
) {
  const userId = useCurrentUserId();
  const ownerNickname = track?.ownerNickname?.trim();
  const ownerProfile = useQuery({
    ...profileQuery(userId, track?.ownerId ?? 0),
    enabled: Boolean(track && !ownerNickname && userId !== null),
  });
  const nickname = ownerNickname || ownerProfile.data?.nickname;
  return {
    name:
      nickname || (ownerProfile.isError ? "이름을 불러오지 못했습니다." : "사용자 이름 확인 중..."),
    imageUrl: track?.ownerProfileImageUrl ?? ownerProfile.data?.profileImageUrl ?? null,
    retry: !nickname && ownerProfile.isError ? () => void ownerProfile.refetch() : null,
  };
}

/** Figma V3 Dialog / Volume (13488:30828). */
export function VolumeDialog({
  value,
  onChange,
  onClose,
  track,
  onChangeInstrument,
  emptyMidi = [],
}: {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  track?: Pick<TrackDto, "ownerId" | "instrument" | "ownerNickname" | "ownerProfileImageUrl">;
  /** Present only when the viewer may change this track's instrument/recording role. */
  onChangeInstrument?: () => void;
  /** Note-free MIDI has no timeline block; the track's settings reopen it. */
  emptyMidi?: { clipId: number; label: string; open: () => void }[];
}) {
  const titleId = useId();
  const owner = useTrackOwner(track);
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, track ? studioStyles.trackVolumeDialog : "")}
      titleId={titleId}
      onClose={onClose}
    >
      {track && (
        <div className={studioStyles.trackSettingsIdentity}>
          <span className="min-w-0 flex-1 pr-4 [&>strong]:truncate">
            <strong aria-live="polite">{owner.name}</strong>
            <small>{track.instrument ? partLabel(track.instrument) : "오디오"}</small>
          </span>
          <Avatar src={owner.imageUrl} />
        </div>
      )}
      {owner.retry && (
        <button
          type="button"
          className="mb-3 text-caption text-app-primary-soft"
          onClick={owner.retry}
        >
          사용자 이름 다시 불러오기
        </button>
      )}
      <h2 id={titleId}>음량</h2>
      <div className={sharedStyles.volumeDialogRow}>
        <span className={sharedStyles.volumeDialogIcon}>
          <Asset name="dialog-volume-sound.svg" />
        </span>
        <input
          autoFocus
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="음량"
          aria-valuetext={`${value}%`}
          style={{
            background: `linear-gradient(to right, var(--white) ${value}%, var(--line-strong) ${value}%)`,
          }}
        />
        <DialogNumberInput
          value={value}
          min={0}
          max={100}
          label="음량 직접 입력"
          onChange={onChange}
        />
      </div>
      {onChangeInstrument && (
        <button
          type="button"
          className={cn(buttonVariants({ tone: "secondary", size: "compact" }), "mt-5 w-full")}
          onClick={onChangeInstrument}
        >
          악기/보컬 변경
        </button>
      )}
      {emptyMidi.map(({ clipId, label, open }) => (
        <button
          key={clipId}
          type="button"
          className={cn(buttonVariants({ tone: "secondary" }), "mt-3 h-11 w-full")}
          onClick={open}
        >
          {label}
        </button>
      ))}
    </CanvasDialog>
  );
}

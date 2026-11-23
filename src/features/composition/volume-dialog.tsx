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
  const userId = useCurrentUserId();
  const ownerNickname = track?.ownerNickname?.trim();
  // Older API deployments omit ownerNickname. Resolve only the opened layer's owner,
  // reusing the same account-scoped profile cache as the profile screen.
  const ownerProfile = useQuery({
    ...profileQuery(userId, track?.ownerId ?? 0),
    enabled: Boolean(track && !ownerNickname && userId !== null),
  });
  const nickname = ownerNickname || ownerProfile.data?.nickname;
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, track ? studioStyles.trackVolumeDialog : "")}
      titleId={titleId}
      onClose={onClose}
    >
      {track && (
        <div className={studioStyles.trackSettingsIdentity}>
          <span className="min-w-0 flex-1 pr-4 [&>strong]:truncate">
            <strong aria-live="polite">
              {nickname ||
                (ownerProfile.isError ? "이름을 불러오지 못했습니다." : "사용자 이름 확인 중...")}
            </strong>
            <small>{track.instrument ? partLabel(track.instrument) : "오디오"}</small>
          </span>
          <Avatar src={track.ownerProfileImageUrl ?? ownerProfile.data?.profileImageUrl} />
        </div>
      )}
      {track && !nickname && ownerProfile.isError && (
        <button
          type="button"
          className="mb-3 text-caption text-app-primary-soft"
          onClick={() => void ownerProfile.refetch()}
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

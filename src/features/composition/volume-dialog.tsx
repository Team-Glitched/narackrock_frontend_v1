import { sharedStyles } from "@/styles/shared.styles";
import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { Asset } from "@/components/ui/asset";
import { Avatar } from "@/components/ui/avatar";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
import { DialogNumberInput } from "@/features/composition/dialog-number-input";
import { useId } from "react";

/** Figma V3 Dialog / Volume (13488:30828). */
export function VolumeDialog({
  value,
  onChange,
  onClose,
  track,
}: {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  track?: { name: string; instrument: string | null };
}) {
  const titleId = useId();
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, track ? studioStyles.trackVolumeDialog : "")}
      titleId={titleId}
      onClose={onClose}
    >
      {track && (
        <div className={studioStyles.trackSettingsIdentity}>
          <span>
            <strong>{track.name}</strong>
            <small>
              {track.instrument === "piano" ? "피아노" : (track.instrument ?? "오디오")}
            </small>
          </span>
          <Avatar />
        </div>
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
    </CanvasDialog>
  );
}

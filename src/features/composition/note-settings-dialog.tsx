import { sharedStyles } from "@/styles/shared.styles";
import { studioStyles } from "@/styles/studio.styles";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
import { DialogNumberInput } from "@/features/composition/dialog-number-input";
import { partLabel } from "./instrument-parts";
import type { MidiNoteDto } from "@/lib/api/composition";
import { useId, useState } from "react";

/** Figma V3 13507:31697; uncontracted effects remain visible but unavailable. */
export function NoteSettingsDialog({
  note: initialNote,
  stepTick,
  maxTick,
  instrument,
  onApply,
  onClose,
}: {
  note: MidiNoteDto;
  stepTick: number;
  maxTick: number;
  instrument: string | null;
  onApply: (note: MidiNoteDto) => boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [note, onChange] = useState(() => structuredClone(initialNote));
  const pitch = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][note.pitch % 12];
  return (
    <CanvasDialog className={studioStyles.noteSettingsDialog} titleId={titleId} onClose={onClose}>
      <div className={studioStyles.noteSettingsIdentity}>
        <strong id={titleId}>Code : {pitch}</strong>
        <span className={sharedStyles.instrumentPickerTrigger}>{partLabel(instrument)}</span>
      </div>
      <label className={studioStyles.noteSettingsLength}>
        길이 :{" "}
        <input
          aria-label="노트 길이"
          type="number"
          min={Math.min(1, initialNote.durationTick / stepTick)}
          max={(maxTick - note.startTick) / stepTick}
          step="any"
          value={note.durationTick / stepTick}
          onChange={(event) => {
            const durationTick = Math.max(
              Math.min(stepTick, initialNote.durationTick),
              Math.round(Math.min(maxTick - note.startTick, Number(event.target.value) * stepTick)),
            );
            onChange({ ...note, durationTick });
          }}
        />
      </label>
      {[
        { label: "울림", disabled: true, value: 20 },
        { label: "음량", disabled: false, value: Math.round((note.velocity / 127) * 100) },
        { label: "일단 효과", disabled: true, value: 20 },
      ].map((control) => (
        <div className={studioStyles.noteSettingsControl} key={control.label}>
          <strong>{control.label}</strong>
          <div>
            <input
              autoFocus={!control.disabled}
              aria-label={control.disabled ? `${control.label} 기능 준비 중` : "노트 음량"}
              type="range"
              min={0}
              max={100}
              value={control.value}
              disabled={control.disabled}
              onChange={(event) =>
                onChange({
                  ...note,
                  velocity: Math.max(1, Math.round((Number(event.target.value) / 100) * 127)),
                })
              }
              style={{
                background: `linear-gradient(to right, var(--white) ${control.value}%, var(--line-strong) ${control.value}%)`,
              }}
            />
            {control.disabled ? (
              <output>{control.value}</output>
            ) : (
              <DialogNumberInput
                value={control.value}
                min={1}
                max={100}
                label="노트 음량 직접 입력"
                onChange={(value) =>
                  onChange({ ...note, velocity: Math.max(1, Math.round((value / 100) * 127)) })
                }
              />
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-3">
        <button onClick={onClose}>취소</button>
        <button onClick={() => { if (onApply(note)) onClose(); }}>적용</button>
      </div>
    </CanvasDialog>
  );
}

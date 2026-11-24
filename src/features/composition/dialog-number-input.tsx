import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useState } from "react";
import { timingFieldText, timingFieldValue } from "./project-timing";

/**
 * Numeric fields commit on Enter or blur so multi-digit values can be typed freely. With
 * `clamp={false}` (timing fields) every keystroke reports the displayed text unrounded (NaN when
 * blank), so the dialog validates and applies exactly what the user sees.
 */
export function DialogNumberInput({
  value,
  min,
  max,
  clamp = true,
  className,
  label,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max?: number;
  clamp?: boolean;
  className?: string;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (!clamp) return;
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) {
      const rounded = Math.round(Number(draft));
      onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, rounded)));
    }
    setDraft(null);
  }
  return (
    <input
      className={cn(sharedStyles.dialogNumberInput, className)}
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      value={clamp ? (draft ?? value) : timingFieldText(draft, value)}
      onChange={(event) => {
        const nextText = event.target.value;
        setDraft(nextText);
        if (!clamp) onChange(timingFieldValue(nextText));
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape" && clamp && draft !== null) {
          event.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

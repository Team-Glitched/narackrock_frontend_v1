import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useState } from "react";

/** Numeric fields commit on Enter or blur so multi-digit values can be typed freely. */
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
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) {
      const rounded = Math.round(Number(draft));
      onChange(clamp ? Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, rounded)) : rounded);
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
      value={draft ?? value}
      onChange={(event) => {
        const nextText = event.target.value;
        setDraft(nextText);
        if (!clamp && nextText.trim() !== "" && Number.isFinite(Number(nextText))) {
          onChange(Math.round(Number(nextText)));
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape" && draft !== null) {
          event.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

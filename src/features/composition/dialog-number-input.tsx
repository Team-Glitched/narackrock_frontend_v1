import { sharedStyles } from "@/styles/shared.styles";
import { useState } from "react";

/** Numeric fields commit on Enter or blur so multi-digit values can be typed freely. */
export function DialogNumberInput({
  value,
  min,
  max,
  label,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max?: number;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft)))
      onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, Math.round(Number(draft)))));
    setDraft(null);
  }
  return (
    <input
      className={sharedStyles.dialogNumberInput}
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
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

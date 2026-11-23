import { useRef } from "react";
import { buttonVariants } from "@/styles/variants";

/** Keeps the browser's filename/empty-state text out of the upload UI. */
export function FilePicker({
  accept,
  label,
  disabled = false,
  onSelect,
}: {
  accept: string;
  label: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0 self-start">
      <input
        ref={input}
        hidden
        className="hidden"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onSelect(file);
        }}
      />
      <button
        type="button"
        className={buttonVariants({ tone: "secondary", size: "compact" })}
        aria-label={label}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        파일 선택
      </button>
    </div>
  );
}

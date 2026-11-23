import { cn } from "@/lib/utils";

/** Floating bottom-right button that toggles composition canvases between portrait and landscape. */
export function OrientationToggleButton({
  portrait,
  onToggle,
  className,
}: {
  portrait: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = portrait ? "가로 모드로 전환" : "세로 모드로 전환";
  return (
    <button
      type="button"
      data-orientation-toggle={portrait ? "to-landscape" : "to-portrait"}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        "orientation-toggle-fab absolute z-[12] inline-flex cursor-pointer items-center justify-center rounded-full border border-[#32323d] bg-[#23232a]/92 text-[#f2f4f6] shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-150 hover:border-[#4e4e5d] hover:bg-[#2c2c37] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2f4f6]/70 motion-reduce:transition-none",
        portrait ? "right-4 bottom-4 size-12" : "right-4 bottom-4 size-11",
        className,
      )}
    >
      <svg
        width={portrait ? 24 : 22}
        height={portrait ? 24 : 22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5.42 8.54 8.54 5.42a1.8 1.8 0 0 1 2.54 0l7.5 7.5a1.8 1.8 0 0 1 0 2.54l-3.12 3.12a1.8 1.8 0 0 1-2.54 0l-7.5-7.5a1.8 1.8 0 0 1 0-2.54Z" />
        <path d="M20.46 9.25A8.9 8.9 0 0 0 14.75 3.54" />
        <path d="M17.03 2.52 14.75 3.54 16 5.71" />
        <path d="M3.54 14.75A8.9 8.9 0 0 0 9.25 20.46" />
        <path d="M6.97 21.48 9.25 20.46 8 18.29" />
      </svg>
    </button>
  );
}

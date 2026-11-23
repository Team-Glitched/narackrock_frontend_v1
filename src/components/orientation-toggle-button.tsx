import { cn } from "@/lib/utils";

/** Floating bottom-right button that toggles composition canvases between portrait and landscape. */
export function OrientationToggleButton({
  portrait,
  onToggle,
  alignedWithTransport = false,
  className,
}: {
  portrait: boolean;
  onToggle: () => void;
  alignedWithTransport?: boolean;
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
        "orientation-toggle-fab absolute z-[12] inline-flex cursor-pointer items-center justify-center rounded-full border border-[#9966ff]/45 bg-[#241e33]/92 text-[#f2f4f6] shadow-[0_8px_22px_rgba(0,0,0,0.48),0_0_0_1px_rgba(109,0,255,0.22)] backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-150 hover:border-[#b388ff]/80 hover:bg-[#31254d] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9966ff] motion-reduce:transition-none",
        portrait
          ? alignedWithTransport
            ? "right-4 bottom-8 size-12"
            : "right-5 bottom-5 size-12"
          : "right-4 bottom-4 size-11",
        className,
      )}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {portrait ? (
          <>
            <rect x="3" y="10" width="14.5" height="10" rx="2.2" />
            <path d="M14.8 13.7v2.6" />
            <path d="M9 4.5a8.86 8.86 0 0 1 11.2 6.8" />
            <path d="M17.9 9.7 20.2 11.3 21.7 8.8" />
          </>
        ) : (
          <>
            <rect x="4" y="6.5" width="10" height="14.5" rx="2.2" />
            <path d="M7.7 18.3h2.6" />
            <path d="M19.7 14.2a8.86 8.86 0 0 0-7-10.4" />
            <path d="M15.2 2.4 12.7 3.8 14.4 6.1" />
          </>
        )}
      </svg>
    </button>
  );
}

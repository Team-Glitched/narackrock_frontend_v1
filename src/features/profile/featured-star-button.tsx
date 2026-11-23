import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeaturedStarButton({
  songTitle,
  pinned,
  busy,
  onToggle,
  variant = "row",
}: {
  songTitle: string;
  pinned: boolean;
  busy: boolean;
  onToggle: () => void;
  variant?: "row" | "card";
}) {
  return (
    <button
      type="button"
      className={cn(
        variant === "card"
          ? "grid size-8 place-items-center rounded-full border border-white/15 bg-[#15151a]/75 backdrop-blur-[2px] transition-colors hover:bg-[#15151a]/90 disabled:opacity-50"
          : "mt-1 ml-2 grid size-9 shrink-0 place-items-center self-start rounded-full p-2 transition-colors hover:bg-app-surface disabled:opacity-50",
        pinned ? "text-amber-400" : variant === "card" ? "text-white/85" : "text-app-muted",
      )}
      aria-pressed={pinned}
      aria-label={pinned ? `${songTitle} 대표 음악 해제` : `${songTitle} 대표 음악 설정`}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Star
        size={variant === "card" ? 16 : 18}
        strokeWidth={variant === "card" ? 2 : 1.75}
        className={pinned ? "fill-amber-400" : undefined}
        aria-hidden="true"
      />
    </button>
  );
}

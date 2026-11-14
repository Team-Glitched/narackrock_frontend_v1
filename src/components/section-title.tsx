import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";

export function SectionTitle({
  children,
  onAll,
  allLabel = "모두보기",
  size = "section",
  id,
  className,
}: {
  children: ReactNode;
  onAll?: () => void;
  allLabel?: string;
  size?: "section" | "subtitle";
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        sharedStyles.sectionTitle,
        "mb-4 flex min-h-[26px] items-center justify-between gap-3 px-5 [@media(max-width:389px)]:px-4",
        className,
      )}
    >
      <h2
        id={id}
        className={cn(
          "m-0 min-w-0 flex-1 truncate font-bold tracking-[-0.4px] text-app-fg",
          size === "subtitle" ? "text-label leading-[22px]" : "text-title leading-[26px]",
        )}
      >
        {children}
      </h2>
      {onAll && (
        <button
          type="button"
          className={
            "relative shrink-0 text-label leading-[20px] font-medium text-app-muted transition-colors hover:text-app-fg after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']"
          }
          onClick={onAll}
        >
          {allLabel}
        </button>
      )}
    </div>
  );
}

import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
export function SectionTitle({
  children,
  onAll,
  allLabel = "모두보기",
}: {
  children: ReactNode;
  onAll?: () => void;
  allLabel?: string;
}) {
  return (
    <div
      className={cn(
        sharedStyles.sectionTitle,
        "mb-[10px] flex h-[18px] items-center justify-between px-4",
      )}
    >
      <h2 className={"m-0 w-[247px] text-title leading-[18px] font-bold tracking-[-0.4px]"}>
        {children}
      </h2>
      {onAll && (
        <button
          className={
            "relative text-label leading-[18px] font-medium text-app-muted after:absolute after:inset-x-0 after:-inset-y-[9px] after:content-['']"
          }
          onClick={onAll}
        >
          {allLabel}
        </button>
      )}
    </div>
  );
}

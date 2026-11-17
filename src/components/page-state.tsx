import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      className={cn(
        "my-auto flex h-full min-h-[280px] flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6",
        "[&>div]:flex [&>div]:flex-col [&>div]:items-center [&>div]:justify-center [&>div]:gap-4",
        "[&>span]:flex [&>span]:flex-col [&>span]:items-center [&>span]:justify-center [&>span]:gap-4",
        "[&_button]:mx-auto",
        error ? "text-[#ff8d8d]" : "text-app-muted",
      )}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

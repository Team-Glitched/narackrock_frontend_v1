import type { ReactNode } from "react";
export function PageState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className="grid h-full place-items-center p-5 text-center text-body text-app-muted" role={error ? "alert" : "status"}>{children}</div>;
}

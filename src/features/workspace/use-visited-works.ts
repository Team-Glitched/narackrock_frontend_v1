import { useEffect, useState } from "react";
import { apiOrigin } from "@/lib/api/client";
import { getComposition } from "@/lib/api/composition";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useWorkspace, type Work } from "./workspace-store";

/** A visit is only a pointer; stale browser snapshots never authorize or render a server project. */
export function useVisitedWorks() {
  const { works: visits } = useWorkspace();
  const userId = useCurrentUserId();
  const scope = `${apiOrigin()}:${userId ?? "guest"}`;
  const [result, setResult] = useState<{
    scope: string;
    works: Work[];
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all(
      visits.map(async (visit) => {
        try {
          const composition = await getComposition(visit.id);
          return { work: { ...visit, title: composition.project.title, composition }, error: null };
        } catch (cause) {
          return {
            work: null,
            error: cause instanceof Error ? cause.message : "작업에 접근할 수 없습니다.",
          };
        }
      }),
    ).then((items) => {
      if (active)
        setResult({
          scope,
          works: items.flatMap((item) => (item.work ? [item.work] : [])),
          error: items.find((item) => item.error)?.error ?? null,
        });
    });
    return () => {
      active = false;
    };
  }, [visits, scope]);
  return result?.scope === scope
    ? { ...result, loading: false }
    : { works: [], error: null, loading: true };
}

import { getComposition } from "../../lib/api/composition.ts";
import { ApiError, SessionChangedError } from "../../lib/api/client.ts";
import type { Work, WorkVisit } from "./workspace-store.ts";
import { workingMusic } from "./working-music.ts";

export async function loadVisitedWorksPage(
  visits: readonly WorkVisit[],
  start: number,
  signal: AbortSignal,
  home = false,
) {
  let offset = start;
  const items: { work: Work | null; error: string | null; missingVisit: WorkVisit | null }[] = [];
  let authenticationFailed = false;
  do {
    signal.throwIfAborted();
    const batch = visits.slice(offset, offset + (home ? 3 : 6));
    const results = await Promise.allSettled(batch.map((visit) => getComposition(visit.id, signal)));
    signal.throwIfAborted();
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const composition = result.value;
        items.push({
          work: { ...batch[index], title: composition.project.title, composition },
          error: null,
          missingVisit: null,
        });
      } else {
        const cause: unknown = result.reason;
        if (cause instanceof SessionChangedError) throw cause;
        if (cause instanceof ApiError && cause.status === 404 && cause.errorCode === "PROJECT_NOT_FOUND") {
          items.push({ work: null, error: null, missingVisit: batch[index] });
        } else if (cause instanceof ApiError && cause.status === 403 && cause.errorCode === "PROJECT_ACCESS_DENIED") {
          // Permissions may be restored later, so keep the visit for future revalidation.
          items.push({ work: null, error: null, missingVisit: null });
        } else {
          const unauthorized = cause instanceof ApiError && cause.status === 401;
          authenticationFailed ||= unauthorized;
          items.push({
            work: null,
            missingVisit: null,
            error: unauthorized
              ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
              : cause instanceof TypeError
                ? "서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요."
                : "일부 작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          });
        }
      }
    });
    offset += batch.length;
  } while (home && !authenticationFailed && offset < visits.length &&
    workingMusic(items.flatMap(({ work }) => work ? [work] : [])).length < 3);

  return { items, next: !home && !authenticationFailed && offset < visits.length ? offset : null };
}

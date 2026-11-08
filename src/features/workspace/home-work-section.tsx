import { buttonVariants } from "@/styles/variants";
import { SectionTitle } from "@/components/section-title";
import { ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { Work } from "./workspace-store";
import { useVisitedWorks } from "./use-visited-works";
import { workingMusic } from "./working-music";
function modifiedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : formatDistanceToNow(date, { addSuffix: true, locale: ko });
}
/** A small arrangement preview drawn from the draft's actual clips. */
function DraftPreview({ work }: { work: Work }) {
  const tracks = work.composition.tracks.slice(0, 4);
  const end = Math.max(
    1,
    ...tracks.flatMap((track) => track.clips.map((clip) => clip.startTick + clip.durationTick)),
  );
  return (
    <svg
      viewBox="0 0 240 88"
      className="block h-[78px] w-full overflow-hidden rounded-md bg-app-panel fill-app-primary"
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <path
          key={`v${i}`}
          d={`M${i * 30} 0V88`}
          className="fill-none stroke-app-border [stroke-width:0.6]"
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={`h${i}`}
          d={`M0 ${i * 22}H240`}
          className="fill-none stroke-app-border [stroke-width:0.6]"
        />
      ))}
      {tracks.map((track, row) => (
        <g key={track.trackId} opacity={1 - row * 0.16}>
          {track.clips.map((clip) => (
            <rect
              key={clip.clipId}
              x={(clip.startTick / end) * 232 + 4}
              y={row * 22 + 5}
              width={Math.max(3, (clip.durationTick / end) * 232 - 4)}
              height={12}
              rx={3}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
export function HomeWorkSection({
  onOpenWorkspace,
  onStartSong,
  onResume,
}: {
  onOpenWorkspace: () => void;
  onStartSong: () => void;
  onResume: (projectId: number, shortId: number | null) => void;
}) {
  const { works, error, loading } = useVisitedWorks({ home: true });
  const items = workingMusic(works);
  return (
    <section className="home-working-music">
      <SectionTitle onAll={items.length ? onOpenWorkspace : undefined}>
        이 브라우저에서 연 작업
      </SectionTitle>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">방문한 작업을 불러오는 중입니다.</p>}
      {items.length ? (
        <div
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scroll-padding-inline:20px]"
          role="group"
          aria-label="이어서 작곡할 음악"
        >
          {items.slice(0, 3).map((work) => {
            const modified = modifiedLabel(work.updatedAt);
            return (
              <button
                className="flex min-w-0 flex-[0_0_244px] snap-start flex-col gap-4 rounded-[14px] border border-solid border-transparent bg-app-surface p-4 text-left transition-[border-color,background] duration-150 ease-[ease] hover:border-app-accent hover:bg-app-raised focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-app-accent motion-reduce:transition-none"
                key={work.id}
                onClick={() => onResume(work.id, work.shortId)}
                aria-label={`${work.title} 이어서 작곡하기`}
              >
                <span className="flex items-center justify-between gap-2 text-caption leading-[18px] font-normal text-app-muted">
                  {modified ? (
                    <time dateTime={work.updatedAt}>{modified} 방문</time>
                  ) : (
                    <span>작업 중</span>
                  )}
                  <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <DraftPreview work={work} />
                <span className="flex w-full min-w-0 flex-col gap-2 [&>strong]:truncate [&>strong]:text-label [&>strong]:leading-[22px] [&>strong]:font-semibold [&>small]:text-caption [&>small]:leading-[18px] [&>small]:font-normal [&>small]:text-app-muted">
                  <strong>{work.title}</strong>
                  <small>
                    레이어 {work.composition.tracks.length}개<span aria-hidden="true"> · </span>
                    {work.composition.project.bpm} BPM
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : !loading && !error ? (
        <div className="mx-5 rounded-[14px] border border-solid border-app-border bg-app-panel p-5 [&>p]:m-0 [&>p]:mb-4 [&>p]:text-body [&>p]:leading-5 [&>p]:font-normal [&>p]:text-app-muted">
          <p>새 곡을 만들거나 음악에 참여해 보세요.</p>
          <button
            className={buttonVariants({
              tone: "primary",
            })}
            onClick={onStartSong}
          >
            작곡 시작하기
          </button>
        </div>
      ) : null}
    </section>
  );
}

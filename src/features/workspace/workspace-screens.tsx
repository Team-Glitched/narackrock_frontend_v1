import { workspaceStyles } from "@/styles/workspace.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { SavedOpenSources } from "@/features/sources/saved-open-sources";
import { AudioPlaybackBar } from "@/components/audio-playback-bar";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { CompositionDto } from "@/lib/api/composition";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { compositionDurationMs } from "@/features/composition/playback-duration";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { Asset } from "@/components/asset";
import { toggleResource, useWorkspace, type Resource, type Work } from "./workspace-store";
import { useVisitedWorks } from "./use-visited-works";
import { apiOrigin } from "@/lib/api/client";
function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(workspaceStyles.workspacePage, sharedStyles.scrollContent)}>
      <h1>{title}</h1>
      {subtitle && <p className={workspaceStyles.workspaceSubtitle}>{subtitle}</p>}
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className={workspaceStyles.workspaceEmpty}>{children}</p>;
}
/** A composition preview player (the web's ClipPlayer): one preview plays at a time. */
export function useClipPlayer(composition: CompositionDto) {
  const userId = useCurrentUserId();
  const player = useCompositionPlayback(composition, {
    scopeKey: JSON.stringify([
      apiOrigin(),
      userId,
      composition?.project.projectId ?? null,
      "workspace",
    ]),
  });
  const id = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const duration = compositionDurationMs(composition);
  const previousVolume = useRef(70);
  const pause = player.pause;
  useEffect(() => {
    const stopOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) pause();
    };
    window.addEventListener("narackrock:clip-preview", stopOther);
    return () => window.removeEventListener("narackrock:clip-preview", stopOther);
  }, [id, pause]);
  async function toggle() {
    if (player.playing) {
      pause();
      return;
    }
    if (loading) return;
    setLoading(true);
    setError("");
    window.dispatchEvent(new CustomEvent("narackrock:clip-preview", { detail: id }));
    try {
      await player.play();
    } catch {
      setError("재생하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }
  return {
    playing: player.playing,
    muted: player.volume === 0,
    positionMs: player.positionMs,
    durationMs: duration,
    disabled: duration === 0,
    loading,
    error,
    toggle: () => void toggle(),
    seek: player.seek,
    toggleMute: () => {
      if (player.volume === 0) player.setVolume(previousVolume.current);
      else {
        previousVolume.current = player.volume;
        player.setVolume(0);
      }
    },
  };
}

export function ClipPlayer({
  composition,
  label = "미리듣기",
}: {
  composition: CompositionDto;
  label?: string;
}) {
  const clip = useClipPlayer(composition);
  return (
    <>
      <AudioPlaybackBar
        playing={clip.playing}
        muted={clip.muted}
        positionMs={clip.positionMs}
        durationMs={clip.durationMs}
        onToggle={clip.toggle}
        onSeek={clip.seek}
        onMute={clip.toggleMute}
        disabled={clip.disabled}
        loading={clip.loading}
        label={label}
      />
      {clip.error && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {clip.error}
        </p>
      )}
    </>
  );
}

export function WorkspaceScreen({
  onStartSong,
  onResume,
}: {
  onStartSong: () => void;
  onResume: (id: number, shortId: number | null) => void;
}) {
  const { works, error, loading, appending, hasMore, more } = useVisitedWorks();
  return (
    <Page
      title="이 브라우저에서 연 작업"
      subtitle="전체 서버 프로젝트 목록이 아닌 방문 이력입니다. 기존 브라우저 자료는 설정의 데이터 이관에서 확인하세요."
    >
      {error && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className={workspaceStyles.workspaceEmpty}>
          방문한 프로젝트의 현재 접근권을 확인하는 중입니다.
        </p>
      )}
      <div className={workspaceStyles.workspaceHeading}>
        <h2>음악 목록</h2>
        <button className={workspaceStyles.workspacePrimary} onClick={onStartSong}>
          새 곡
        </button>
      </div>
      {works.length === 0
        ? !loading &&
          !hasMore &&
          !error && (
            <Empty>
              아직 작업 중인 곡이 없습니다. 새 곡을 만들거나 숏폼에서 작곡에 참여해보세요.
            </Empty>
          )
        : works.map((work) => (
            <article
              className={cn(
                workspaceStyles.workspaceCard,
                "[.design-canvas_&]:flex items-center justify-between gap-3",
              )}
              key={work.id}
            >
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <span className={workspaceStyles.workspaceStatus}>
                  {work.shortId === null ? uiLabels.myMusic : "참여한 작업"}
                </span>
                <h2 className="m-0!">{work.title}</h2>
                <p>
                  {work.composition.tracks.length}개 레이어 · {work.composition.project.bpm} BPM
                </p>
              </div>
              <button
                className={cn(
                  workspaceStyles.workspacePrimary,
                  "min-h-10 shrink-0 rounded-[20px] px-4 py-2 text-label font-medium leading-5 text-app-fg",
                )}
                onClick={() => onResume(work.id, work.shortId)}
              >
                이어하기
              </button>
            </article>
          ))}
      {hasMore && (
        <button className={workspaceStyles.workspaceWide} disabled={appending} onClick={more}>
          더보기
        </button>
      )}
    </Page>
  );
}

type LibraryFilter = "SERVER" | "LOCAL";
const localTab: [LibraryFilter, string][] = [["LOCAL", "이 기기의 MIDI 작업"]];
const libraryTabs: [LibraryFilter, string][] = [["SERVER", "보관한 샘플"], ...localTab];

/**
 * The sample library's state: filter, search, the local MIDI works it shows, the import in flight, and
 * the song a local work is added to (`targetResource`, with the visited works to choose from).
 */
export function useSourceLibrary(
  importing: boolean,
  onUse: (resource: Resource, work?: Work) => Promise<void>,
) {
  const { resources } = useWorkspace();
  const [targetResource, setTargetResource] = useState<Resource | null>(null);
  const visited = useVisitedWorks({ enabled: targetResource !== null });
  const [filter, setFilter] = useState<LibraryFilter>(importing ? "LOCAL" : "SERVER"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [notice, setNotice] = useState("");
  const items = resources.filter(
    (r) =>
      filter === "LOCAL" &&
      `${r.title} ${r.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  async function use(resource: Resource, work?: Work) {
    if (!importing && !work) {
      setTargetResource(resource);
      return;
    }
    if (busy !== null) return;
    setBusy(resource.id);
    setNotice("");
    try {
      await onUse(resource, work);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "가져오지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }
  function toggleFavorite(id: number) {
    try {
      toggleResource(id);
    } catch {
      setNotice("저장하지 못했습니다.");
    }
  }
  return {
    targetResource,
    setTargetResource,
    visited,
    filter,
    setFilter,
    query,
    setQuery,
    busy,
    notice,
    items,
    use,
    toggleFavorite,
  };
}

export function SourceLibraryScreen({
  onUse,
  importing = false,
  onStartSong,
  onOpenSources,
  onOpenSource,
}: {
  onUse: (resource: Resource, work?: Work) => Promise<void>;
  importing?: boolean;
  onStartSong: () => void;
  onOpenSources: () => void;
  onOpenSource: (id: number) => void;
}) {
  const library = useSourceLibrary(importing, onUse);
  const {
    targetResource,
    setTargetResource,
    filter,
    setFilter,
    query,
    setQuery,
    busy,
    notice,
    items,
    use,
    toggleFavorite,
  } = library;
  const { works, error: workError, loading, appending, hasMore, more } = library.visited;
  if (targetResource)
    return (
      <Page
        title="사용할 곡 선택"
        subtitle={`${targetResource.title} 레이어를 추가할 곡을 선택하세요.`}
      >
        <button className={workspaceStyles.workspaceWide} onClick={() => setTargetResource(null)}>
          리소스 목록으로 돌아가기
        </button>
        {workError && (
          <p role="alert" className={workspaceStyles.workspaceNotice}>
            {workError}
          </p>
        )}
        {loading && (
          <p role="status" className={workspaceStyles.workspaceEmpty}>
            작업을 불러오는 중입니다.
          </p>
        )}
        {works.length === 0
          ? !loading &&
            !hasMore &&
            !workError && (
              <Empty>
                작업 중인 곡이 없습니다. 새 곡을 만든 뒤 레이어 추가에서 보관함을 열어주세요.
              </Empty>
            )
          : works.map((work) => (
              <button
                key={work.id}
                className={cn(workspaceStyles.workspaceCard, workspaceStyles.workspaceCardLink)}
                disabled={busy !== null}
                onClick={() => void use(targetResource, work)}
              >
                <h2>{work.title}</h2>
                <p>
                  {work.composition.tracks.length}개 레이어 ·{" "}
                  {work.shortId === null ? uiLabels.myMusic : "참여한 작업"}
                </p>
                <small>이 곡에 추가 →</small>
              </button>
            ))}
        {hasMore && (
          <button className={workspaceStyles.workspaceWide} disabled={appending} onClick={more}>
            더보기
          </button>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className={workspaceStyles.workspaceWide} onClick={onStartSong}>
          새 곡 만들기
        </button>
      </Page>
    );
  return (
    <Page
      title={importing ? "MIDI 가져오기" : uiLabels.sourceLibrary}
      subtitle={
        importing
          ? "이 기기에 남아 있는 MIDI 작업을 개인 초안으로 가져옵니다."
          : "보관한 샘플은 계정에, MIDI 작업은 이 기기에 저장됩니다."
      }
    >
      <label className={workspaceStyles.workspaceSearch}>
        <Asset name="search-input.svg" />
        <input
          aria-label="보관함 검색"
          placeholder="리소스 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className={workspaceStyles.workspaceTabs}>
        {(importing ? localTab : libraryTabs).map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className={workspaceStyles.workspaceNotice}>
          {notice}
        </p>
      )}
      {filter === "LOCAL" && items.length === 0 ? (
        <Empty>
          이 기기에 남아 있는 MIDI 작업이 없습니다. 이전 작업은 설정의 데이터 이관·복구에서 내보낼
          수 있습니다.
        </Empty>
      ) : (
        items.map((r) => (
          <article className={workspaceStyles.workspaceCard} key={r.id}>
            <span className={workspaceStyles.workspaceStatus}>이 기기에 저장된 MIDI 작업</span>
            <h2>{r.title}</h2>
            <p>{r.description}</p>
            <ClipPlayer composition={r.composition} label={`${r.title} 미리듣기`} />
            <div className={workspaceStyles.workspaceActions}>
              <button aria-pressed={r.saved} onClick={() => toggleFavorite(r.id)}>
                {r.saved ? "로컬 즐겨찾기됨" : "로컬 즐겨찾기"}
              </button>
              <button
                className={workspaceStyles.workspacePrimary}
                disabled={busy !== null}
                onClick={() => void use(r)}
              >
                {busy === r.id
                  ? "가져오는 중…"
                  : importing
                    ? "개인 초안으로 가져오기"
                    : "선택한 곡의 개인 초안으로"}
              </button>
            </div>
          </article>
        ))
      )}
      {!importing && filter === "SERVER" && (
        <SavedOpenSources query={query} onOpen={onOpenSource} />
      )}
      {!importing && (
        <button className={workspaceStyles.workspaceWide} onClick={onOpenSources}>
          샘플 둘러보기
        </button>
      )}
    </Page>
  );
}

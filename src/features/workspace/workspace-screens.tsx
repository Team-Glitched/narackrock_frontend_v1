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
export function ClipPlayer({
  composition,
  label = "미리듣기",
}: {
  composition: CompositionDto;
  label?: string;
}) {
  const userId = useCurrentUserId();
  const player = useCompositionPlayback(composition, {
    scopeKey: JSON.stringify([apiOrigin(), userId, composition?.project.projectId ?? null, "workspace"]),
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
  return (
    <>
      <AudioPlaybackBar
        playing={player.playing}
        muted={player.volume === 0}
        positionMs={player.positionMs}
        durationMs={duration}
        onToggle={() => void toggle()}
        onSeek={player.seek}
        onMute={() => {
          if (player.volume === 0) player.setVolume(previousVolume.current);
          else {
            previousVolume.current = player.volume;
            player.setVolume(0);
          }
        }}
        disabled={duration === 0}
        loading={loading}
        label={label}
      />
      {error && (
        <p role="alert" className={workspaceStyles.workspaceNotice}>
          {error}
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
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">방문한 프로젝트의 현재 접근권을 확인하는 중입니다.</p>}
      <div className={workspaceStyles.workspaceHeading}>
        <h2>음악 목록</h2>
        <button className={workspaceStyles.workspacePrimary} onClick={onStartSong}>
          새 곡
        </button>
      </div>
      {works.length === 0 ? (!loading && !hasMore && !error && (
        <Empty>아직 작업 중인 곡이 없습니다. 새 곡을 만들거나 숏폼에서 작곡에 참여해보세요.</Empty>)
      ) : (
        works.map((work) => (
          <article className={workspaceStyles.workspaceCard} key={work.id}>
            <span className={workspaceStyles.workspaceStatus}>
              {work.shortId === null ? uiLabels.myMusic : "참여한 작업"}
            </span>
            <h2>{work.title}</h2>
            <p>
              {work.composition.tracks.length}개 레이어 · {work.composition.project.bpm} BPM
            </p>
            <div className={workspaceStyles.workspaceActions}>
              <button
                className={workspaceStyles.workspacePrimary}
                onClick={() => onResume(work.id, work.shortId)}
              >
                이어하기
              </button>
            </div>
          </article>
        ))
      )}
      {hasMore && <button className={workspaceStyles.workspaceWide} disabled={appending} onClick={more}>더보기</button>}
    </Page>
  );
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
  const { resources } = useWorkspace();
  const [targetResource, setTargetResource] = useState<Resource | null>(null);
  const { works, error: workError, loading, appending, hasMore, more } =
    useVisitedWorks({ enabled: targetResource !== null });
  const [filter, setFilter] = useState(importing ? "LOCAL" : "SERVER"),
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
  if (targetResource)
    return (
      <Page
        title="사용할 곡 선택"
        subtitle={`${targetResource.title} 레이어를 추가할 곡을 선택하세요.`}
      >
        <button className={workspaceStyles.workspaceWide} onClick={() => setTargetResource(null)}>
          리소스 목록으로 돌아가기
        </button>
        {workError && <p role="alert">{workError}</p>}
        {loading && <p role="status">작업을 불러오는 중입니다.</p>}
        {works.length === 0 ? (!loading && !hasMore && !workError && (
          <Empty>
            작업 중인 곡이 없습니다. 새 곡을 만든 뒤 레이어 추가에서 보관함을 열어주세요.
          </Empty>)
        ) : (
          works.map((work) => (
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
          ))
        )}
        {hasMore && <button className={workspaceStyles.workspaceWide} disabled={appending} onClick={more}>더보기</button>}
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
          : "보관한 오픈소스는 계정에, MIDI 작업은 이 기기에 저장됩니다."
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
        {(importing
          ? [["LOCAL", "이 기기의 MIDI 작업"]]
          : [
              ["SERVER", "보관한 오픈소스"],
              ["LOCAL", "이 기기의 MIDI 작업"],
            ]
        ).map(([value, label]) => (
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
          이 기기에 남아 있는 MIDI 작업이 없습니다. 이전 작업은 설정의 데이터 이관·복구에서 내보낼 수
          있습니다.
        </Empty>
      ) : (
        items.map((r) => (
          <article className={workspaceStyles.workspaceCard} key={r.id}>
            <span className={workspaceStyles.workspaceStatus}>
              이 기기에 저장된 MIDI 작업
            </span>
            <h2>{r.title}</h2>
            <p>{r.description}</p>
            <ClipPlayer composition={r.composition} label={`${r.title} 미리듣기`} />
            <div className={workspaceStyles.workspaceActions}>
              <button
                aria-pressed={r.saved}
                onClick={() => {
                  try {
                    toggleResource(r.id);
                  } catch {
                    setNotice("저장하지 못했습니다.");
                  }
                }}
              >
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
          오픈소스 둘러보기
        </button>
      )}
    </Page>
  );
}

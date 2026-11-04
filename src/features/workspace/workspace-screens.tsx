import { workspaceStyles } from "@/styles/workspace.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { SavedOpenSources } from "@/features/sources/saved-open-sources";
import { AudioPlaybackBar } from "@/components/ui/audio-playback-bar";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  getComposition,
  listContributions,
  getContributionInbox,
  reviewContribution,
  type ContributionDto,
  type CompositionDto,
} from "@/lib/api/composition";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { compositionDurationMs } from "@/features/composition/playback-duration";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { Asset } from "@/components/ui/asset";
import { toggleResource, useWorkspace, type Resource, type Work } from "./workspace-store";
import { useVisitedWorks } from "./use-visited-works";
const labels = { PENDING: "승인 대기", APPROVED: "승인됨", REJECTED: "반려됨" };
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
  const player = useCompositionPlayback(composition);
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
  const { works, error, loading } = useVisitedWorks();
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
      {works.length === 0 ? (
        <Empty>아직 작업 중인 곡이 없습니다. 새 곡을 만들거나 숏폼에서 작곡에 참여해보세요.</Empty>
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
    </Page>
  );
}
export function SubmissionsScreen({
  onSelect,
}: {
  onSelect: (id: number, projectId: number) => void;
}) {
  const { works } = useWorkspace();
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{ userId: number | null; items: ContributionDto[] } | null>(
    null,
  );
  const items = result?.userId === userId ? result.items : [];
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all(works.map((work) => listContributions(work.id)))
      .then((lists) => {
        if (active)
          setResult({ userId, items: lists.flat().filter((item) => item.userId === userId) });
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "제출을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [works, userId]);
  return (
    <Page
      title="확인된 프로젝트의 제출"
      subtitle="이 브라우저에서 연 프로젝트만 조회합니다. 전체 프로젝트 간 제출 목록 API는 없습니다."
    >
      {error && <p role="alert">{error}</p>}
      {!items.length && (
        <Empty>확인된 제출이 없습니다. 프로젝트를 열어 방문 이력에 추가해주세요.</Empty>
      )}
      {items.map((item) => (
        <button
          className={workspaceStyles.workspaceCard}
          key={`${item.projectId}:${item.contributionId}`}
          onClick={() => onSelect(item.contributionId, item.projectId)}
        >
          <strong>
            #{item.contributionId} · {labels[item.approvalStatus]}
          </strong>
          <p>{item.description}</p>
          <small>{item.createdAt}</small>
        </button>
      ))}
    </Page>
  );
}

export function ReviewInboxScreen({
  onSelect,
}: {
  onSelect: (id: number, projectId: number) => void;
}) {
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{
    userId: number | null;
    items: Awaited<ReturnType<typeof getContributionInbox>>;
  } | null>(null);
  const items = result?.userId === userId ? result.items : [];
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getContributionInbox()
      .then((items) => {
        if (active) setResult({ userId, items });
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "검토 요청을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <Page title="받은 참여 요청" subtitle="서버의 기여 알림으로 확인한 요청입니다.">
      {error && <p role="alert">{error}</p>}
      {!items.length && <Empty>받은 참여 요청이 없습니다.</Empty>}
      {items.map((item) => (
        <button
          className={workspaceStyles.workspaceCard}
          key={`${item.projectId}:${item.contributionId}`}
          onClick={() => onSelect(item.contributionId, item.projectId)}
        >
          <strong>
            {item.projectTitle} · #{item.contributionId}
          </strong>
          <p>
            {item.nickname} · {item.description}
          </p>
        </button>
      ))}
    </Page>
  );
}

export function SubmissionDetailScreen({
  id,
  projectId,
  onResume,
}: {
  id: number;
  projectId: number | null;
  onResume: (id: number, shortId: number | null) => void;
}) {
  const userId = useCurrentUserId();
  const [item, setItem] = useState<ContributionDto | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (projectId === null) return;
    let active = true;
    Promise.all([listContributions(projectId), getComposition(projectId)])
      .then(([items, composition]) => {
        if (!active) return;
        const found = items.find((entry) => entry.contributionId === id) ?? null;
        setItem(found);
        setCanReview(composition.viewerPermission.canReviewContribution);
        if (!found) setError("서버에서 제출을 찾지 못했습니다.");
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "제출을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [id, projectId, userId]);
  if (projectId === null)
    return (
      <Page title="제출 상세">
        <Empty>
          이전 링크에 프로젝트 ID가 없습니다. 로컬 가짜 ID는 서버 제출 ID로 사용할 수 없습니다.
          설정의 복구 자료를 확인해주세요.
        </Empty>
      </Page>
    );
  return (
    <Page title="서버 제출 상세">
      {error && <p role="alert">{error}</p>}
      {!item ? (
        <p>제출을 불러오는 중입니다.</p>
      ) : (
        <>
          <h2>
            제출 #{item.contributionId} · {labels[item.approvalStatus]}
          </h2>
          <p>
            {item.nickname} · {item.description}
          </p>
          <p>
            프로젝트 #{projectId} · 기준 버전 {item.baseProjectVersion.display} · {item.createdAt}
          </p>
          <ul>
            {item.items.map((entry, index) => (
              <li key={index}>
                {entry.changeType} {entry.targetType} #{entry.targetId} · {entry.itemStatus}
              </li>
            ))}
          </ul>
          <p>검토 결과: {item.reviewComment ?? "등록된 검토 의견이 없습니다."}</p>
          <p>
            서버는 불변 제출 음원·노트 snapshot을 제공하지 않습니다. 현재 클립을 과거 제출 음원으로
            재생하지 않습니다.
          </p>
          {canReview && item.approvalStatus === "PENDING" && (
            <div>
              <label>
                검토 의견
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
              </label>
              {(["APPROVED", "REJECTED"] as const).map((status) => (
                <button
                  key={status}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await reviewContribution(projectId, id, status, comment.trim() || null);
                      setItem(
                        (await listContributions(projectId)).find(
                          (entry) => entry.contributionId === id,
                        ) ?? null,
                      );
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : "검토 결과를 저장하지 못했습니다.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {status === "APPROVED" ? "승인" : "반려"}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => onResume(projectId, null)}>현재 프로젝트 열기</button>
        </>
      )}
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
  const { works, error: workError } = useVisitedWorks();
  const [targetResource, setTargetResource] = useState<Resource | null>(null);
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
        {works.length === 0 ? (
          <Empty>
            작업 중인 곡이 없습니다. 새 곡을 만든 뒤 레이어 추가에서 보관함을 열어주세요.
          </Empty>
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
          ? "이 브라우저의 MIDI 원본을 개인 초안으로 가져옵니다."
          : "서버 보관 목록과 이 브라우저의 MIDI 복구 자료는 별개입니다."
      }
    >
      {workError && <p role="alert">{workError}</p>}
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
          ? [["LOCAL", "이 브라우저 MIDI 복구"]]
          : [
              ["SERVER", "서버 오픈소스 보관"],
              ["LOCAL", "이 브라우저 MIDI 복구"],
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
          이 브라우저의 MIDI 복구 자료가 없습니다. 이전 작성물은 설정의 데이터 이관·복구에서 내보낼
          수 있습니다.
        </Empty>
      ) : (
        items.map((r) => (
          <article className={workspaceStyles.workspaceCard} key={r.id}>
            <span className={workspaceStyles.workspaceStatus}>
              이 브라우저의 MIDI 원본 · 서버 보관 자료 아님
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

import { workspaceStyles } from "@/styles/workspace.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { SavedOpenSources } from "@/features/sources/saved-open-sources";
import { AudioPlaybackBar } from "@/components/audio-playback-bar";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { CompositionDto } from "@/lib/api/composition";
import { compositionQuery } from "@/features/composition/composition-queries";
import { contributionInboxQuery, contributionsQuery, useReviewContributionMutation } from "./workspace-queries";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { compositionDurationMs } from "@/features/composition/playback-duration";
import { useCompositionPlayback } from "@/features/composition/use-composition-playback";
import { Asset } from "@/components/asset";
import { toggleResource, useWorkspace, type Resource, type Work } from "./workspace-store";
import { useVisitedWorks } from "./use-visited-works";
import { apiOrigin } from "@/lib/api/client";
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
export function SubmissionsScreen({
  onSelect,
}: {
  onSelect: (id: number, projectId: number) => void;
}) {
  const { works } = useWorkspace();
  const userId = useCurrentUserId();
  const lists = useQueries({
    queries: works.map((work) => ({ ...contributionsQuery(userId, work.id), enabled: userId !== null })),
  });
  const loading = userId !== null && lists.some((list) => list.isPending || (list.isError && list.isFetching));
  const failed = loading ? 0 : lists.filter((list) => list.isError).length;
  const items = lists.flatMap((list) => list.data?.filter((item) => item.userId === userId) ?? []);
  return (
    <Page
      title="확인된 프로젝트의 제출"
      subtitle="이 브라우저에서 연 프로젝트만 조회합니다. 전체 프로젝트 간 제출 목록 API는 없습니다."
    >
      {userId === null && <Empty>로그인 후 내 제출을 확인할 수 있습니다.</Empty>}
      {loading && <p role="status">제출 목록을 불러오는 중입니다.</p>}
      {!loading && !!failed && (
        <div>
          <p role="alert">
            {failed === works.length
              ? "제출 목록을 불러오지 못했습니다."
              : `${failed}개 프로젝트의 제출을 불러오지 못했습니다.`}
          </p>
          <button type="button" onClick={() => lists.forEach((list) => { if (list.isError) void list.refetch(); })}>
            다시 시도
          </button>
        </div>
      )}
      {userId !== null && !loading && !failed && !items.length && (
        <Empty>
          {works.length
            ? "이 브라우저에서 연 프로젝트에 내 제출이 없습니다."
            : "이 브라우저에서 연 프로젝트가 없습니다."}
        </Empty>
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
  const inbox = useQuery(contributionInboxQuery(userId));
  const items = inbox.data ?? [];
  const error = inbox.error ? inbox.error.message || "검토 요청을 불러오지 못했습니다." : "";
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
  const [comment, setComment] = useState("");
  const contributions = useQuery({ ...contributionsQuery(userId, projectId ?? 0), enabled: projectId !== null });
  const composition = useQuery({ ...compositionQuery(userId, projectId ?? 0), enabled: projectId !== null });
  const review = useReviewContributionMutation();
  const loaded = contributions.data && composition.data;
  const item = loaded ? contributions.data.find((entry) => entry.contributionId === id) ?? null : null;
  const canReview = composition.data?.viewerPermission.canReviewContribution ?? false;
  const loadError = contributions.error ?? composition.error;
  const error = review.error
    ? review.error.message || "검토 결과를 저장하지 못했습니다."
    : loadError
      ? loadError.message || "제출을 불러오지 못했습니다."
      : loaded && !item
        ? "서버에서 제출을 찾지 못했습니다."
        : "";
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
                  disabled={review.isPending}
                  onClick={() => {
                    if (!review.isPending)
                      review.mutate({ projectId, contributionId: id, status, comment: comment.trim() || null });
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

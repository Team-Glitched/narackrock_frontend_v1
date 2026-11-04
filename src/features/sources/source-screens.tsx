import { sourceStyles } from "@/styles/source.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Avatar } from "@/components/ui/avatar";
import { PageState } from "@/components/ui/page-state";
import { PostActions } from "@/features/posts/post-actions";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SourcePlayback } from "@/features/sources/source-playback";
import { ApiError } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { shareLink } from "@/lib/share-link";
import { relativeTime } from "@/features/posts/post-utils";
import {
  createOpenSourceComment,
  getOpenSource,
  getOpenSourceComments,
  getOpenSourceShare,
  listOpenSources,
  reactToOpenSource,
  reactToOpenSourceComment,
  setOpenSourceSaved,
  type OpenSourceDetail,
  type OpenSourceSummary,
} from "@/lib/api/open-sources";

export function sourceError(cause: unknown, fallback = "오픈소스를 불러오지 못했습니다.") {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    if (cause.status === 403) return "이 오픈소스에 접근할 권한이 없습니다.";
    if (cause.status === 404) return "삭제되었거나 비공개인 오픈소스입니다.";
    return cause.message || fallback;
  }
  return cause instanceof TypeError ? "서버에 연결하지 못했습니다. 네트워크를 확인해주세요." : fallback;
}

/** Server save state of one source, updated only from the PUT/DELETE response. */
function useSourceSave(source: Pick<OpenSourceSummary, "openSourceId" | "isSaved">) {
  const [saved, setSaved] = useState<{ id: number; value: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = saved?.id === source.openSourceId ? saved.value : source.isSaved;
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await setOpenSourceSaved(source.openSourceId, !value);
      setSaved({ id: result.openSourceId, value: result.isSaved });
    } catch (cause) {
      setError(sourceError(cause, "보관함을 변경하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }
  return { saved: value, busy, error, toggle };
}

function SaveButton({ save }: { save: ReturnType<typeof useSourceSave> }) {
  return (
    <button
      className={cn(buttonVariants({ tone: "primary" }), sourceStyles.osSaveButton)}
      aria-pressed={save.saved}
      disabled={save.busy}
      onClick={() => void save.toggle()}
    >
      {save.saved ? "저장됨" : "저장"}
    </button>
  );
}

function OpenSourceCard({
  source,
  onOpen,
  onProfile,
}: {
  source: OpenSourceSummary;
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const save = useSourceSave(source);
  return (
    <article className={sourceStyles.osCard}>
      <div className={sourceStyles.osHead}>
        <button className={sourceStyles.osAuthor} onClick={() => onOpen(source.openSourceId)} aria-label={`${source.title} 보기`}>
          <Avatar src={source.thumbnailUrl} />
          <span>
            <strong>{source.title}</strong>
            <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>
          </span>
        </button>
        <SaveButton save={save} />
      </div>
      {save.error && <p role="alert">{save.error}</p>}
      <button className={sourceStyles.osBody} onClick={() => onOpen(source.openSourceId)}>
        {source.description ?? ""}
      </button>
      <div className={sourceStyles.osFoot}>
        <button className={sourceStyles.osFootAuthor} onClick={() => onProfile(source.writer.userId)}>
          <Avatar src={source.writer.profileImageUrl} />
          <span>{source.writer.nickname}</span>
        </button>
        <PostActions
          compact
          readOnly
          likeCount={source.likeCount}
          dislikeCount={source.dislikeCount}
          commentCount={source.commentCount}
          vote={source.isLiked ? "like" : source.isDisliked ? "dislike" : null}
          onVote={() => undefined}
          onComments={() => onOpen(source.openSourceId, true)}
        />
      </div>
    </article>
  );
}

type ListState = { key: string; items: OpenSourceSummary[]; page: number; hasNext: boolean; error?: string };

/** Paged public source list for a keyword; following pages are appended until the server reports no more. */
export function useOpenSourceList(keyword: string, enabled: boolean) {
  const userId = useCurrentUserId();
  const [retry, setRetry] = useState(0);
  const key = `${userId}:${keyword.trim()}:${retry}`;
  const [state, setState] = useState<ListState | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => {
    if (!enabled || userId === null) return;
    const controller = new AbortController();
    listOpenSources({ keyword, page: 0 }, controller.signal)
      .then((page) => setState({ key, items: page.items, page: 0, hasNext: page.hasNext }))
      .catch((cause) => {
        if (!controller.signal.aborted) setState({ key, items: [], page: 0, hasNext: false, error: sourceError(cause) });
      });
    return () => controller.abort();
  }, [enabled, key, keyword, userId]);
  const current = state?.key === key ? state : null;
  async function more() {
    if (!current?.hasNext || moreBusy) return;
    setMoreBusy(true);
    try {
      const next = await listOpenSources({ keyword, page: current.page + 1 });
      setState((old) =>
        old?.key === key
          ? {
              key,
              page: next.page,
              hasNext: next.hasNext,
              items: [...old.items, ...next.items.filter((item) => !old.items.some((seen) => seen.openSourceId === item.openSourceId))],
            }
          : old,
      );
    } catch (cause) {
      setState((old) => (old?.key === key ? { ...old, error: sourceError(cause) } : old));
    } finally {
      setMoreBusy(false);
    }
  }
  return { state: current, more, moreBusy, retry: () => setRetry((value) => value + 1), signedIn: userId !== null };
}

export function OpensourceScreen({
  onOpen,
  onProfile,
}: {
  onOpen: (id: number, comments?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const list = useOpenSourceList("", true);
  if (!list.signedIn) return <SignInRequired>오픈소스는 로그인 후 볼 수 있습니다.</SignInRequired>;
  const { state } = list;
  return (
    <div className={cn(sourceStyles.opensourceView, sharedStyles.scrollContent, sourceStyles.osDiscoverySections)}>
      <section aria-label="오픈소스 인기 차트">
        <SectionTitle>인기 차트</SectionTitle>
        <p className={sourceStyles.osDiscoveryEmpty}>인기 차트는 현재 서버에서 지원하지 않습니다.</p>
      </section>
      <section aria-label="추천 오픈소스">
        <SectionTitle>추천 오픈소스</SectionTitle>
        <p className={sourceStyles.osDiscoveryEmpty}>추천 오픈소스는 현재 서버에서 지원하지 않습니다.</p>
      </section>
      <section aria-label="전체 오픈소스">
        <SectionTitle>전체 오픈소스</SectionTitle>
        {!state && <p role="status">오픈소스를 불러오는 중...</p>}
        {state?.error && (
          <div role="alert">
            <p>{state.error}</p>
            <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={list.retry}>
              다시 시도
            </button>
          </div>
        )}
        {state && !state.error && state.items.length === 0 && (
          <p className={sourceStyles.osDiscoveryEmpty}>아직 공개된 오픈소스가 없습니다.</p>
        )}
        {state && state.items.length > 0 && (
          <div className={sourceStyles.osDiscoveryList}>
            {state.items.map((source) => (
              <OpenSourceCard key={source.openSourceId} source={source} onOpen={onOpen} onProfile={onProfile} />
            ))}
          </div>
        )}
        {state?.hasNext && (
          <button className={communityStyles.nrCommentsMore} disabled={list.moreBusy} onClick={() => void list.more()}>
            {list.moreBusy ? "불러오는 중..." : "더보기"}
          </button>
        )}
      </section>
    </div>
  );
}

function SourceDetail({
  source,
  onComments,
  onProfile,
}: {
  source: OpenSourceDetail;
  onComments: () => void;
  onProfile: (id: number) => void;
}) {
  const save = useSourceSave(source);
  const [reaction, setReaction] = useState<Pick<OpenSourceDetail, "isLiked" | "isDisliked" | "likeCount" | "dislikeCount"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const current = reaction ?? source;
  async function vote(kind: "like" | "dislike") {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      setReaction(await reactToOpenSource(source.openSourceId, kind));
    } catch (cause) {
      setNotice(sourceError(cause, "반응을 반영하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    setNotice("");
    try {
      const { shareUrl } = await getOpenSourceShare(source.openSourceId);
      const link = canonicalShareLink("source", source.openSourceId, shareUrl, window.location.origin);
      setNotice((await shareLink(source.title, link)) ?? "");
    } catch (cause) {
      setNotice(
        cause instanceof DOMException
          ? "공유 링크를 복사하지 못했습니다."
          : cause instanceof Error && !(cause instanceof ApiError) && !(cause instanceof TypeError)
            ? cause.message
            : sourceError(cause, "공유 링크를 만들지 못했습니다."),
      );
    }
  }
  return (
    <div className={sourceStyles.opensourceDetail}>
      <section className={sourceStyles.osDetailArticle}>
        <div className={sourceStyles.osDetailTitleRow}>
          <div className={sourceStyles.osDetailTitle}>
            <Avatar src={source.thumbnailUrl} />
            <span>
              <strong>{source.title}</strong>
              <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>
            </span>
          </div>
          <SaveButton save={save} />
        </div>
        {save.error && <p role="alert">{save.error}</p>}
        <button className={sourceStyles.osDetailByline} onClick={() => onProfile(source.writer.userId)}>
          <Avatar src={source.writer.profileImageUrl} />
          <span>{source.writer.nickname}</span>
        </button>
        <p className={sourceStyles.osDetailCopy}>{source.description ?? ""}</p>
        <SourcePlayback sourceId={source.openSourceId} canPreview={source.canPreview} durationMs={source.durationMs} />
        <p className={sourceStyles.osDiscoveryEmpty}>곡에 오픈소스 넣기는 현재 서버에서 지원하지 않습니다.</p>
        <PostActions
          likeCount={current.likeCount}
          dislikeCount={current.dislikeCount}
          commentCount={source.commentCount}
          vote={current.isLiked ? "like" : current.isDisliked ? "dislike" : null}
          onVote={(kind) => void vote(kind)}
          busy={busy || save.busy}
          onComments={onComments}
          saved={save.saved}
          onSave={() => void save.toggle()}
          onShare={() => void share()}
        />
        {notice && <p role="status">{notice}</p>}
      </section>
      <div className={communityStyles.nrPostCommentDivider} />
    </div>
  );
}

export function OpensourceDetailScreen({
  sourceId,
  focusComments,
  onProfile,
}: {
  sourceId: number;
  focusComments: boolean;
  onProfile: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  const [retry, setRetry] = useState(0);
  const key = `${userId}:${sourceId}:${retry}`;
  const [loaded, setLoaded] = useState<{ key: string; source?: OpenSourceDetail; error?: string } | null>(null);
  const [focus, setFocus] = useState(focusComments ? 1 : 0);
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    getOpenSource(sourceId, controller.signal)
      .then((source) => setLoaded({ key, source }))
      .catch((cause) => {
        if (!controller.signal.aborted) setLoaded({ key, error: sourceError(cause) });
      });
    return () => controller.abort();
  }, [key, sourceId, userId]);
  const adapter = useMemo<CommentAdapter>(
    () => ({
      async load(parentId, page) {
        const result = await getOpenSourceComments(sourceId, parentId, page);
        return {
          page: result.page,
          total: result.totalCount,
          items: result.comments.map((comment) => ({
            id: comment.commentId,
            parentId: comment.parentCommentId,
            userId: comment.writer.userId,
            author: comment.writer.nickname,
            avatarUrl: comment.writer.profileImageUrl,
            text: comment.content,
            time: relativeTime(comment.createdAt),
            replyCount: comment.replyCount,
            likes: comment.likeCount,
            dislikes: comment.dislikeCount,
            isLiked: comment.isLiked,
            isDisliked: comment.isDisliked,
          })),
        };
      },
      create: (text, parentId) => createOpenSourceComment(sourceId, text, parentId),
      react: reactToOpenSourceComment,
    }),
    [sourceId],
  );
  if (userId === null) return <SignInRequired>오픈소스는 로그인 후 볼 수 있습니다.</SignInRequired>;
  const current = loaded?.key === key ? loaded : null;
  if (!current) return <PageState>오픈소스를 불러오는 중...</PageState>;
  if (current.error || !current.source)
    return (
      <PageState error>
        <span className="grid gap-3">
          <span>{current.error}</span>
          <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={() => setRetry((value) => value + 1)}>
            다시 시도
          </button>
        </span>
      </PageState>
    );
  return (
    <div className={sourceStyles.opensourceDetailShell}>
      <CommonComments
        key={key}
        adapter={adapter}
        currentUserId={userId}
        onProfile={onProfile}
        focus={focus}
        onCreated={() => setRetry((value) => value + 1)}
        header={<SourceDetail source={current.source} onComments={() => setFocus((value) => value + 1)} onProfile={onProfile} />}
      />
    </div>
  );
}

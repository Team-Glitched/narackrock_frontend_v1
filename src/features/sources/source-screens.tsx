import { sourceStyles } from "@/styles/source.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionTitle } from "@/components/section-title";
import { Avatar } from "@/components/avatar";
import { PageState } from "@/components/page-state";
import { PostActions } from "@/features/posts/post-actions";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SourcePlayback } from "@/features/sources/source-playback";
import { ApiError } from "@/lib/api/client";
import { canonicalShareLink } from "@/lib/api/content-link";
import { useShareLink } from "@/hooks/use-share-link";
import { relativeTime } from "@/features/posts/post-utils";
import {
  createOpenSourceComment,
  getOpenSourceComments,
  getOpenSourceShare,
  reactToOpenSource,
  reactToOpenSourceComment,
  type OpenSourceDetail,
  type OpenSourceSummary,
} from "@/lib/api/open-sources";
import { openSourceListQuery, openSourceQuery, patchSource, sourceKeys, useSourceSaveMutation } from "./source-queries";

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
  const mutation = useSourceSaveMutation();
  return {
    saved: source.isSaved,
    busy: mutation.isPending,
    error: mutation.error ? sourceError(mutation.error, "보관함을 변경하지 못했습니다.") : "",
    toggle: () => {
      if (!mutation.isPending) mutation.mutate({ sourceId: source.openSourceId, saved: !source.isSaved });
    },
  };
}

function SaveButton({ save }: { save: ReturnType<typeof useSourceSave> }) {
  return (
    <button
      className={cn(buttonVariants({ tone: "primary" }), sourceStyles.osSaveButton)}
      aria-pressed={save.saved}
      disabled={save.busy}
      onClick={save.toggle}
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
            {source.usageCount != null && <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>}
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

/** Paged public source list for a keyword; following pages are appended until the server reports no more. */
export function useOpenSourceList(keyword: string, enabled: boolean) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const options = openSourceListQuery(userId, keyword.trim());
  const query = useInfiniteQuery({ ...options, enabled: enabled && userId !== null });
  const { data, error, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } = query;
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (data?.pages ?? []).flatMap((page) => page.items).filter((item) => {
      if (seen.has(item.openSourceId)) return false;
      seen.add(item.openSourceId);
      return true;
    });
  }, [data]);
  const state =
    data || (error && !isFetching)
      ? { items, hasNext: hasNextPage, error: error ? sourceError(error) : undefined }
      : null;
  return {
    state,
    more: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    moreBusy: isFetchingNextPage,
    retry: () => void queryClient.resetQueries({ queryKey: options.queryKey, exact: true }),
    signedIn: userId !== null,
  };
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
  const sharing = useShareLink();
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const reaction = useMutation({
    mutationFn: (kind: "like" | "dislike") => reactToOpenSource(source.openSourceId, kind),
    onSuccess: (result) => patchSource(queryClient, userId, source.openSourceId, result),
  });
  const [notice, setNotice] = useState("");
  function vote(kind: "like" | "dislike") {
    if (reaction.isPending) return;
    setNotice("");
    reaction.mutate(kind, { onError: (cause) => setNotice(sourceError(cause, "반응을 반영하지 못했습니다.")) });
  }
  async function share() {
    setNotice("");
    try {
      const { shareUrl } = await getOpenSourceShare(source.openSourceId);
      const link = canonicalShareLink("source", source.openSourceId, shareUrl, window.location.origin);
      setNotice((await sharing.share(source.title, link)) ?? "");
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
      {sharing.dialog}
      <section className={sourceStyles.osDetailArticle}>
        <div className={sourceStyles.osDetailTitleRow}>
          <div className={sourceStyles.osDetailTitle}>
            <Avatar src={source.thumbnailUrl} />
            <span>
              <strong>{source.title}</strong>
              {source.usageCount != null && <small>사용 수 {source.usageCount.toLocaleString("ko-KR")}</small>}
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
          likeCount={source.likeCount}
          dislikeCount={source.dislikeCount}
          commentCount={source.commentCount}
          vote={source.isLiked ? "like" : source.isDisliked ? "dislike" : null}
          onVote={vote}
          busy={reaction.isPending || save.busy}
          onComments={onComments}
          saved={save.saved}
          onSave={save.toggle}
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
  const queryClient = useQueryClient();
  const query = useQuery({ ...openSourceQuery(userId, sourceId), enabled: userId !== null });
  const [focus, setFocus] = useState(focusComments ? 1 : 0);
  const adapter = useMemo<CommentAdapter>(
    () => ({
      kind: "sources",
      targetId: sourceId,
      async load(parentId, page, signal) {
        const result = await getOpenSourceComments(sourceId, parentId, page, signal);
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
  const source = query.data;
  if (!source && (!query.error || query.isFetching)) return <PageState>오픈소스를 불러오는 중...</PageState>;
  if (!source)
    return (
      <PageState error>
        <span className="grid gap-3">
          <span>{sourceError(query.error)}</span>
          <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={() => void query.refetch()}>
            다시 시도
          </button>
        </span>
      </PageState>
    );
  return (
    <div className={sourceStyles.opensourceDetailShell}>
      <CommonComments
        adapter={adapter}
        currentUserId={userId}
        onProfile={onProfile}
        focus={focus}
        // The detail's comment count is server-owned: reread it after a comment is added or removed.
        onChanged={() => void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(userId, sourceId) })}
        header={<SourceDetail source={source} onComments={() => setFocus((value) => value + 1)} onProfile={onProfile} />}
      />
    </div>
  );
}

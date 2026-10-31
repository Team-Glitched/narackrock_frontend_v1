import { communityStyles } from "@/styles/community.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { PostUserActionsMenu } from "@/components/app/dialog";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { ReportReasons } from "@/components/app/report-reasons";
import type { CommentAdapter, CommentItem, CommentPage } from "./comment-model";

function useCommentPage(adapter: CommentAdapter, parentId: number | null, revision: number) {
  const [reload, setReload] = useState(0);
  const key = `${parentId}:${revision}:${reload}`;
  const [loaded, setLoaded] = useState<{ key: string; data: CommentPage } | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => {
    let active = true;
    adapter
      .load(parentId, 0)
      .then((data) => {
        if (active) {
          setLoaded({ key, data });
          setError(null);
        }
      })
      .catch((cause) => {
        if (active)
          setError({
            key,
            text: cause instanceof Error ? cause.message : "댓글을 불러오지 못했습니다.",
          });
      });
    return () => {
      active = false;
    };
  }, [adapter, parentId, key]);
  const data = loaded?.key === key ? loaded.data : null;
  async function more() {
    if (!data || moreBusy) return;
    setMoreBusy(true);
    setError(null);
    try {
      const next = await adapter.load(parentId, data.page + 1);
      setLoaded((current) =>
        current?.key === key
          ? {
              key,
              data: {
                ...next,
                items: [
                  ...current.data.items,
                  ...next.items.filter(
                    (item) => !current.data.items.some((old) => old.id === item.id),
                  ),
                ],
              },
            }
          : current,
      );
    } catch (cause) {
      setError({
        key,
        text: cause instanceof Error ? cause.message : "답글을 더 불러오지 못했습니다.",
      });
    } finally {
      setMoreBusy(false);
    }
  }
  return {
    data,
    error: error?.key === key ? error.text : null,
    more,
    moreBusy,
    retry: () => setReload((value) => value + 1),
  };
}

export function CommonComments({
  adapter,
  currentUserId,
  onProfile,
  canWrite = true,
  onCreated,
  focus = false,
  header,
}: {
  adapter: CommentAdapter;
  currentUserId: number | null;
  onProfile?: (id: number) => void;
  canWrite?: boolean;
  onCreated?: () => void;
  focus?: boolean | number;
  header?: React.ReactNode;
}) {
  const writable = canWrite && currentUserId !== null;
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [reply, setReply] = useState<{ threadId: number; author: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [votes, setVotes] = useState<Record<number, "like" | "dislike" | null>>({});
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus]);
  const top = useCommentPage(adapter, null, revision);
  const changed = () => setRevision((value) => value + 1);
  const toggle = (id: number) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const startReply = (item: CommentItem, threadId: number) => {
    setReply({ threadId, author: item.author });
    setExpanded((old) => new Set([...old, threadId]));
    input.current?.focus();
  };
  const vote = (id: number, next: "like" | "dislike") =>
    setVotes((old) => ({ ...old, [id]: old[id] === next ? null : next }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !writable || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adapter.create(draft.trim(), reply?.threadId ?? null);
      setDraft("");
      setReply(null);
      changed();
      onCreated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const row = (item: CommentItem, threadId: number) => (
    <CommentCard
      key={item.id}
      item={item}
      owner={currentUserId === item.userId}
      adapter={adapter}
      onChanged={changed}
      canReply={writable}
      onReply={() => {
        if (writable) startReply(item, threadId);
      }}
      onProfile={() => onProfile?.(item.userId)}
      onReport={() => setReport(true)}
      vote={votes[item.id] ?? null}
      onVote={(next) => vote(item.id, next)}
    />
  );
  return (
    <div className={communityStyles.nrComments}>
      <div
        className={cn(communityStyles.nrCommentsList, sharedStyles.scrollContent)}
        aria-label="댓글 목록"
      >
        {header}
        {top.error && (
          <div role="alert">
            {top.error}
            <button onClick={changed}>다시 시도</button>
          </div>
        )}
        {!top.data && !top.error && <p role="status">댓글을 불러오는 중...</p>}
        {top.data?.items.length === 0 && (
          <p className={communityStyles.nrCommentsEmpty}>첫 댓글을 남겨보세요.</p>
        )}
        {top.data?.items.map((item) => (
          <section
            className={communityStyles.nrCommentThread}
            key={item.id}
            aria-label={`${item.author} 댓글 대화`}
          >
            {row(item, item.id)}
            {item.replyCount > 0 && (
              <button
                className={communityStyles.nrRepliesToggle}
                aria-expanded={expanded.has(item.id)}
                onClick={() => toggle(item.id)}
              >
                {expanded.has(item.id) ? "답글 접기" : `답글 ${item.replyCount}개`}
              </button>
            )}
            {expanded.has(item.id) && item.replyCount > 0 && (
              <Replies
                key={item.id}
                adapter={adapter}
                parentId={item.id}
                revision={revision}
                render={(child) => row(child, item.id)}
                onCollapse={() => toggle(item.id)}
              />
            )}
          </section>
        ))}
        {top.data && top.data.items.length < top.data.total && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={top.moreBusy}
            onClick={() => void top.more()}
          >
            {top.moreBusy ? "불러오는 중..." : "댓글 더보기"}
          </button>
        )}
      </div>
      <form className={communityStyles.nrCommentComposer} onSubmit={submit}>
        {reply && (
          <div className={communityStyles.nrCommentReplying}>
            <span>{reply.author}에게 답글</span>
            <button type="button" aria-label="답글 취소" onClick={() => setReply(null)}>
              <Asset name="search-close.svg" />
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className={communityStyles.nrCommentInput}>
          <span className={communityStyles.nrCommentAttachment} aria-hidden="true">
            <i />
            <i />
          </span>
          <input
            ref={input}
            aria-label="댓글 내용"
            placeholder={
              currentUserId === null
                ? "로그인 후 댓글을 작성할 수 있습니다."
                : canWrite
                  ? "입력"
                  : "댓글 작성은 준비 중입니다."
            }
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy || !writable}
          />
          <button
            type="submit"
            aria-label="댓글 보내기"
            disabled={busy || !writable || !draft.trim()}
          >
            <Asset name="comment-send.svg" />
          </button>
        </div>
      </form>
      {report && (
        <FigmaSheet title="신고" onClose={() => setReport(false)}>
          <ReportReasons />
        </FigmaSheet>
      )}
    </div>
  );
}
function Replies({
  adapter,
  parentId,
  revision,
  render,
  onCollapse,
}: {
  adapter: CommentAdapter;
  parentId: number;
  revision: number;
  render: (item: CommentItem) => React.ReactNode;
  onCollapse: () => void;
}) {
  const page = useCommentPage(adapter, parentId, revision);
  return (
    <div className={communityStyles.nrCommentReplies}>
      <button
        className={communityStyles.nrRepliesRail}
        aria-label="답글 접기"
        onClick={onCollapse}
      />
      <div className={communityStyles.nrRepliesBody}>
        {page.error && (
          <div role="alert">
            <p>{page.error}</p>
            <button className={communityStyles.nrCommentsMore} onClick={page.retry}>
              다시 시도
            </button>
          </div>
        )}
        {!page.data && !page.error && <p role="status">답글을 불러오는 중...</p>}
        {page.data?.items.map(render)}
        {page.data && page.data.items.length < page.data.total && (
          <button
            className={communityStyles.nrCommentsMore}
            disabled={page.moreBusy}
            onClick={() => void page.more()}
          >
            {page.moreBusy
              ? "불러오는 중..."
              : `더보기 (${page.data.total - page.data.items.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
function CommentCard({
  item,
  canReply,
  owner,
  adapter,
  onChanged,
  onReply,
  onProfile,
  onReport,
  vote,
  onVote,
}: {
  item: CommentItem;
  canReply: boolean;
  owner: boolean;
  adapter: CommentAdapter;
  onChanged: () => void;
  onReply: () => void;
  onProfile: () => void;
  onReport: () => void;
  vote: "like" | "dislike" | null;
  onVote: (next: "like" | "dislike") => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  async function change(remove = false) {
    if (busy || (!remove && !draft.trim())) return;
    setBusy(true);
    setError(null);
    try {
      if (remove) await adapter.remove(item.id);
      else await adapter.update(item.id, draft.trim());
      setEditing(false);
      setConfirm(false);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  if (hidden) return null;
  return (
    <article className={communityStyles.nrCommentCard}>
      <div className={communityStyles.nrCommentAuthor}>
        <button
          className={communityStyles.nrCommentAvatar}
          aria-label={`${item.author} 프로필`}
          onClick={onProfile}
        >
          <Avatar src={item.avatarUrl} />
        </button>
        <strong>{item.author}</strong>
        <span>• {item.time}</span>
        <button
          ref={optionButton}
          className={communityStyles.nrCommentMore}
          aria-label="댓글 더보기"
          aria-expanded={menu}
          onClick={() => setMenu((value) => !value)}
        >
          <Asset name="post-more.svg" />
        </button>
      </div>
      {menu && (
        <PostUserActionsMenu
          anchorRef={optionButton}
          onClose={() => setMenu(false)}
          onReport={() => {
            setMenu(false);
            onReport();
          }}
          onHide={() => {
            setMenu(false);
            setHidden(true);
          }}
          onEdit={
            owner
              ? () => {
                  setEditing(true);
                  setMenu(false);
                }
              : undefined
          }
          onDelete={
            owner
              ? () => {
                  setConfirm(true);
                  setMenu(false);
                }
              : undefined
          }
        />
      )}
      {editing ? (
        <form
          className={communityStyles.nrCommentEdit}
          onSubmit={(event) => {
            event.preventDefault();
            void change();
          }}
        >
          <textarea
            aria-label="댓글 내용 수정"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
          <button disabled={busy || !draft.trim()}>저장</button>
        </form>
      ) : (
        <button className={communityStyles.nrCommentText} onClick={onReply} disabled={!canReply}>
          {item.text}
        </button>
      )}
      {confirm && (
        <div className={communityStyles.nrCommentDelete}>
          <p>이 댓글을 삭제할까요?</p>
          <button onClick={() => setConfirm(false)}>취소</button>
          <button disabled={busy} onClick={() => void change(true)}>
            삭제 확인
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className={communityStyles.nrCommentActions}>
        <button
          aria-label="댓글 좋아요"
          aria-pressed={vote === "like"}
          onClick={() => onVote("like")}
        >
          <Asset name={vote === "like" ? "v3-comment-like-on.svg" : "v3-comment-like-off.svg"} />
          {item.likes + Number(vote === "like")}
        </button>
        <button
          aria-label="댓글 싫어요"
          aria-pressed={vote === "dislike"}
          onClick={() => onVote("dislike")}
        >
          <Asset
            name={vote === "dislike" ? "v3-comment-dislike-on.svg" : "v3-comment-dislike-off.svg"}
          />
        </button>
        <button aria-label={`${item.author}에게 답글 작성`} disabled={!canReply} onClick={onReply}>
          <Asset name="comment-reply.svg" />
        </button>
      </div>
    </article>
  );
}

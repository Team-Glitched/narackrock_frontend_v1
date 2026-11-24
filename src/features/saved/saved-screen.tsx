import { filterChip, filterChipRow } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useState } from "react";
import { Asset } from "@/components/asset";
import { AlbumArtwork } from "@/components/music-card";
import { pickDefaultCover } from "@/lib/default-covers";
import { Avatar } from "@/components/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { listBookmarkedPosts, listBookmarkedShorts } from "@/lib/api/bookmarks";
import { togglePostBookmark } from "@/lib/api/community";
import { toggleShortBookmark } from "@/lib/api/shorts";
import { usePagedItems, type ItemPage } from "@/hooks/use-paged-items";
import { ApiError } from "@/lib/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyPostBookmark } from "@/features/posts/post-queries";
import { updateCachedShort } from "@/features/abyss/abyss-queries";

const filterClass = filterChip;

type SavedItem = { id: number; kind: "post" | "song"; title: string; author: string; imageUrl: string | null; galleryName?: string };

const failure = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : cause instanceof TypeError ? "서버에 연결하지 못했습니다." : fallback;

async function loadSavedPosts(page: number, signal: AbortSignal): Promise<ItemPage<SavedItem, number>> {
  const result = await listBookmarkedPosts(page, signal);
  return {
    items: result.posts.map((post) => ({
      id: post.postId,
      kind: "post",
      title: post.title,
      author: post.writer.nickname ?? "알 수 없는 사용자",
      imageUrl: post.imageUrl,
      galleryName: post.gallery?.name,
    })),
    next: result.posts.length && (page + 1) * result.size < result.totalCount ? page + 1 : null,
  };
}

async function loadSavedSongs(cursor: number, signal: AbortSignal): Promise<ItemPage<SavedItem, number>> {
  const result = await listBookmarkedShorts(cursor === 0 ? null : cursor, signal);
  return {
    items: result.items.map((short) => ({
      id: short.shortId,
      kind: "song",
      title: short.title,
      author: short.author.nickname ?? "알 수 없는 사용자",
      imageUrl: short.albumImageUrl,
    })),
    next: result.page.hasMore ? result.page.nextCursor : null,
  };
}

type SavedScreenProps = {
  onOpenPost: (id: number) => void;
  onOpenSong: (id: number) => void;
};

export function SavedScreen(props: SavedScreenProps) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>저장한 콘텐츠는 로그인 후 볼 수 있습니다.</SignInRequired>;
  return <SavedLibrary key={userId} {...props} />;
}

/** The signed-in user's saved posts and abyss songs, with the unsave action and option menu. */
export function useSavedLibrary() {
  const hiddenPosts = useHiddenPosts();
  const [kind, setKind] = useState<"post" | "song">("post");
  const [openedSongs, setOpenedSongs] = useState(false);
  const posts = usePagedItems(["saved", "posts"], 0, loadSavedPosts);
  const songs = usePagedItems(["saved", "songs"], 0, loadSavedSongs, openedSongs);
  const [menu, setMenu] = useState<number | null>(null);
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const list = kind === "post" ? posts : songs;
  const visible = list.state?.items.filter((item) => item.kind !== "post" || !hiddenPosts.ids.has(item.id)) ?? [];

  const unsave = useMutation({
    mutationFn: async (item: SavedItem) => {
      const toggle = () => item.kind === "post" ? togglePostBookmark(item.id) : toggleShortBookmark(item.id);
      // The toggle may re-add an item removed elsewhere. Toggle again to restore the intended removal.
      if ((await toggle()).isBookmarked && (await toggle()).isBookmarked)
        throw new Error("저장 해제 상태를 확인하지 못했습니다. 목록을 새로 고쳐주세요.");
    },
    onSuccess: async (_, item) => {
      // The feed reads its own short snapshots, so invalidating only the detail leaves its saved icon stale.
      if (item.kind === "song")
        await updateCachedShort(queryClient, userId, item.id, (short) => ({ ...short, isBookmarked: false }));
      else await applyPostBookmark(queryClient, userId, item.id, false);
      if (item.kind === "post" && posts.state?.next !== null) posts.reload();
      else (item.kind === "post" ? posts : songs).remove((row) => row.id === item.id);
    },
  });
  const busy = unsave.isPending;
  const error = unsave.isError ? failure(unsave.error, "저장 해제에 실패했습니다.") : null;
  function select(next: "post" | "song") {
    if (next === "song") setOpenedSongs(true);
    setKind(next);
    setMenu(null);
    unsave.reset();
  }
  return {
    kind,
    select,
    list,
    visible,
    menu,
    setMenu,
    unsave,
    busy,
    error,
    listError: list.state?.error ? failure(list.state.error.cause, "저장 목록을 불러오지 못했습니다.") : null,
  };
}

function SavedLibrary({ onOpenPost, onOpenSong }: SavedScreenProps) {
  const { kind, select, list, visible, menu, setMenu, unsave, busy, error, listError } = useSavedLibrary();

  return (
    <section
      className="scrollbar-none flex h-full flex-col gap-5 overflow-x-hidden overflow-y-auto px-5 pt-6 pb-10"
      aria-label={uiLabels.saved}
    >
      <h1 className="m-0 text-title leading-[26px] font-bold">{uiLabels.saved}</h1>
      <div className={filterChipRow} aria-label="저장 목록 종류">
        <button
          className={filterClass}
          aria-pressed={kind === "post"}
          onClick={() => select("post")}
        >
          게시글
        </button>
        <button
          className={filterClass}
          aria-pressed={kind === "song"}
          onClick={() => select("song")}
        >
          어비스
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-xl border border-solid border-app-border px-4 py-3 text-label leading-6 text-[#ff8d8d]">
          {error}
        </p>
      )}
      {!list.state ? (
        <p role="status" className="my-auto flex flex-1 items-center justify-center px-5 py-12 text-center text-label leading-6 text-app-muted">
          저장 목록을 불러오는 중...
        </p>
      ) : visible.length === 0 && !list.state.error && list.state.next === null ? (
        <p className="my-auto flex flex-1 items-center justify-center px-5 py-12 text-center text-label leading-6 text-app-muted">
          저장한 {kind === "post" ? "게시글이" : "어비스가"} 없습니다.
          <br />
          마음에 드는 콘텐츠의 저장 버튼을 눌러보세요.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {visible.map((item) => (
            <li key={item.id} className="relative flex items-center gap-2">
              <button
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 text-left",
                  kind === "post" && "items-center gap-3",
                )}
                onClick={() => (kind === "post" ? onOpenPost(item.id) : onOpenSong(item.id))}
              >
                {kind === "song" ? (
                  <AlbumArtwork
                    src={item.imageUrl}
                    title={item.title}
                    seed={`short:${item.id}`}
                    className="size-16 shrink-0 rounded-[8px]"
                  />
                ) : (
                  <span className="size-20 flex-[0_0_80px] overflow-hidden rounded-[6px] bg-app-surface [&>img]:size-full [&>img]:object-cover">
                    <img
                      src={item.imageUrl?.trim() || pickDefaultCover(`post:${item.id}`)}
                      alt={item.imageUrl ? "게시글 첨부 이미지" : "게시글 기본 이미지"}
                    />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden [&>strong]:block [&>strong]:w-full [&>strong]:truncate [&>strong]:text-label [&>strong]:leading-[22px] [&>strong]:font-semibold [&>small]:truncate [&>small]:text-body [&>small]:leading-[20px] [&>small]:text-app-muted">
                  <strong>{item.title}</strong>
                  {kind === "post" ? (
                    <span className="flex min-w-0 items-center gap-1.5 text-body leading-[20px] text-app-muted">
                      <Avatar size="xs" />
                      <span className="min-w-0 truncate">{item.author}</span>
                    </span>
                  ) : (
                    <small>{item.author}</small>
                  )}
                </span>
              </button>
              <button
                className="grid size-8 shrink-0 place-items-center rounded-full text-app-fg [&>img]:size-5"
                aria-label={`${item.title} 저장 옵션`}
                aria-expanded={menu === item.id}
                onClick={() => setMenu(menu === item.id ? null : item.id)}
              >
                <Asset name="option.svg" />
              </button>
              {menu === item.id && (
                <div className="absolute top-full right-0 z-5 rounded-lg bg-app-surface shadow-[0_4px_18px_#0005] [&>button]:px-5 [&>button]:py-3 [&>button]:text-body">
                  <button
                    disabled={busy || list.state?.busy}
                    onClick={() => unsave.mutate(item, { onSuccess: () => setMenu(null) })}
                  >
                    저장 해제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.state?.error && (
        <div className="my-auto flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center text-label leading-6 text-app-muted">
          <p role="alert" className="m-0 text-[#ff8d8d]">
            {listError}
          </p>
          {list.state.next !== null && (
            <button
              type="button"
              className="rounded-full bg-app-surface px-5 py-2.5 text-label font-medium text-app-fg disabled:opacity-50"
              disabled={list.state.busy || busy}
              onClick={list.more}
            >
              {list.state.busy ? "불러오는 중..." : "다시 시도"}
            </button>
          )}
        </div>
      )}
      {list.state && !list.state.error && list.state.next !== null && (
        <button
          type="button"
          className="mx-auto min-h-11 w-full rounded-full bg-app-surface px-5 py-2.5 text-label font-medium text-app-fg disabled:opacity-50"
          disabled={list.state.busy || busy}
          onClick={list.more}
        >
          {list.state.busy ? "불러오는 중..." : "더보기"}
        </button>
      )}
      <p className="m-0 mt-2 text-body leading-[1.6] text-app-muted">
        내 계정에 저장한 콘텐츠입니다.
      </p>
    </section>
  );
}

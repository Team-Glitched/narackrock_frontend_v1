import { filterChipVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useEffect, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { listAllBookmarkedPosts, listAllBookmarkedShorts } from "@/lib/api/bookmarks";
import { togglePostBookmark } from "@/lib/api/community";
import { toggleShortBookmark } from "@/lib/api/shorts";
import { ApiError } from "@/lib/api/client";

const filterClass = filterChipVariants();

type SavedItem = { id: number; kind: "post" | "song"; title: string; author: string; imageUrl: string | null };

const failure = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : cause instanceof TypeError ? "서버에 연결하지 못했습니다." : fallback;

/** The account's server bookmarks (posts by page, shorts by cursor), reloaded on account change. */
export function SavedScreen({
  onOpenPost,
  onOpenSong,
}: {
  onOpenPost: (id: number) => void;
  onOpenSong: (id: number) => void;
}) {
  const userId = useCurrentUserId();
  const hiddenPosts = useHiddenPosts();
  const [retry, setRetry] = useState(0);
  const key = `${userId}:${retry}`;
  const [loaded, setLoaded] = useState<{ key: string; items: SavedItem[]; error?: string } | null>(null);
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    Promise.all([listAllBookmarkedPosts(controller.signal), listAllBookmarkedShorts(controller.signal)])
      .then(([posts, shorts]) =>
        setLoaded({
          key,
          items: [
            ...posts.map((post) => ({
              id: post.postId,
              kind: "post" as const,
              title: post.title,
              author: post.writer.nickname ?? "알 수 없는 사용자",
              imageUrl: post.imageUrl,
            })),
            ...shorts.map((short) => ({
              id: short.shortId,
              kind: "song" as const,
              title: short.title,
              author: short.author.nickname ?? "알 수 없는 사용자",
              imageUrl: short.albumImageUrl,
            })),
          ],
        }),
      )
      .catch((cause) => {
        if (!controller.signal.aborted) setLoaded({ key, items: [], error: failure(cause, "저장 목록을 불러오지 못했습니다.") });
      });
    return () => controller.abort();
  }, [key, userId]);
  if (userId === null) return <SignInRequired>저장한 콘텐츠는 로그인 후 볼 수 있습니다.</SignInRequired>;
  const current = loaded?.key === key ? loaded : null;
  if (!current) return <p role="status">저장 목록을 불러오는 중...</p>;
  if (current.error)
    return (
      <div role="alert">
        <p>{current.error}</p>
        <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
      </div>
    );
  return (
    <SavedLibrary
      items={current.items.filter((item) => item.kind !== "post" || !hiddenPosts.ids.has(item.id))}
      onRemove={async (item) => {
        const toggle = () => (item.kind === "post" ? togglePostBookmark(item.id) : toggleShortBookmark(item.id));
        // The bookmark API only toggles. If it was already removed elsewhere, the toggle re-added it, so a
        // second toggle restores the removal the user asked for instead of leaving it saved.
        if ((await toggle()).isBookmarked && (await toggle()).isBookmarked)
          throw new Error("저장 해제 상태를 확인하지 못했습니다. 목록을 새로 고쳐주세요.");
        setLoaded((old) =>
          old?.key === key ? { ...old, items: old.items.filter((entry) => entry.kind !== item.kind || entry.id !== item.id) } : old,
        );
      }}
      onOpenPost={onOpenPost}
      onOpenSong={onOpenSong}
    />
  );
}
function SavedLibrary({
  items,
  onRemove,
  onOpenPost,
  onOpenSong,
}: {
  items: SavedItem[];
  onRemove: (item: SavedItem) => Promise<void>;
  onOpenPost: (id: number) => void;
  onOpenSong: (id: number) => void;
}) {
  const [kind, setKind] = useState<"post" | "song">("post");
  const [menu, setMenu] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = items.filter((item) => item.kind === kind);
  return (
    <section
      className="scrollbar-none h-full overflow-x-hidden overflow-y-auto px-5 py-[30px]"
      aria-label={uiLabels.saved}
    >
      <h1 className="m-0 mb-6 text-title leading-7 font-bold">{uiLabels.saved}</h1>
      <div className="flex items-center gap-[10px]" aria-label="저장 목록 종류">
        <button
          className={filterClass}
          aria-pressed={kind === "post"}
          onClick={() => {
            setKind("post");
            setMenu(null);
          }}
        >
          게시글
        </button>
        <button
          className={filterClass}
          aria-pressed={kind === "song"}
          onClick={() => {
            setKind("song");
            setMenu(null);
          }}
        >
          음악
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {visible.length === 0 ? (
        <p className="my-[70px] text-center text-body leading-[1.8] text-app-muted">
          저장한 {kind === "post" ? "게시글" : "음악"}이 없습니다.
          <br />
          마음에 드는 콘텐츠의 저장 버튼을 눌러보세요.
        </p>
      ) : (
        <ul
          className={cn(
            "my-[30px] flex list-none flex-col gap-[30px] p-0",
            kind === "song" && "mt-5",
          )}
        >
          {visible.map((item) => (
            <li key={item.id} className="relative flex items-center gap-1">
              <button
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-[10px] text-left",
                  kind === "post" && "items-start gap-5",
                )}
                onClick={() => (kind === "post" ? onOpenPost(item.id) : onOpenSong(item.id))}
              >
                <span
                  className={cn(
                    "h-[52px] flex-[0_0_52px] overflow-hidden rounded-[5px] bg-app-fg [&>img]:size-full [&>img]:object-cover",
                    kind === "post" && "h-[90px] flex-[0_0_90px] rounded",
                  )}
                >
                  {item.imageUrl && <img src={item.imageUrl} alt="" />}
                </span>
                <span
                  className={cn(
                    "flex min-w-0 flex-col gap-2 [&>strong]:text-label [&>strong]:leading-[1.3] [&>strong]:font-semibold [&>small]:text-body [&>small]:text-app-muted",
                    kind === "post" &&
                      "gap-5 [&>strong]:line-clamp-2 [&>strong]:text-body [&>strong]:font-medium",
                  )}
                >
                  <strong>{item.title}</strong>
                  {kind === "post" ? (
                    <span className="flex items-center gap-[6px] text-caption">
                      <Avatar className="size-5" />
                      <span>{item.author}</span>
                    </span>
                  ) : (
                    <small>{item.author}</small>
                  )}
                </span>
              </button>
              <button
                className={cn(
                  "grid min-h-11 w-10 flex-[0_0_40px] place-items-center [&>img]:size-5",
                  kind === "post" && "absolute -right-[10px] -bottom-[18px]",
                )}
                aria-label={`${item.title} 저장 옵션`}
                aria-expanded={menu === item.id}
                onClick={() => setMenu(menu === item.id ? null : item.id)}
              >
                <Asset name="option.svg" />
              </button>
              {menu === item.id && (
                <div className="absolute top-full right-0 z-5 rounded-lg bg-app-surface shadow-[0_4px_18px_#0005] [&>button]:px-5 [&>button]:py-3 [&>button]:text-body">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await onRemove(item);
                        setMenu(null);
                      } catch (cause) {
                        setError(failure(cause, "저장 해제에 실패했습니다."));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    저장 해제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-6 text-caption leading-[1.6] text-app-muted">
        내 계정에 저장한 콘텐츠입니다.
      </p>
    </section>
  );
}

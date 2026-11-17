import { profileStyles } from "@/styles/profile.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants, filterChip, filterChipRow } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FigmaSheet } from "@/components/figma-sheet";
import { Avatar } from "@/components/avatar";
import { MiniPost } from "@/features/posts/post-list";
import type { UserProfile } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { postDetailQuery } from "@/features/posts/post-queries";
import { mutualFollowersQuery } from "@/features/social/social-queries";
import { relationsQuery } from "./profile-queries";

export type ProfileListKind = "followers" | "following" | "articles";
type ProfileListProps = { kind: ProfileListKind; profile: UserProfile; onClose: () => void; onProfile: (id: number) => void; onPost: (id: number) => void };

/** Data of the followers / following / posts sheet; shared by the web sheet and the app. */
export function useProfileList(kind: ProfileListKind, profile: UserProfile) {
  const userId = useCurrentUserId();
  const ownFollowers = userId === profile.userId && kind === "followers";
  const relations = useQuery({ ...relationsQuery(userId, profile.userId, kind === "articles" ? "followers" : kind), enabled: kind !== "articles" });
  const articles = useQueries({
    queries: kind === "articles" ? profile.activities.posts.map(({ postId }) => postDetailQuery(userId, postId)) : [],
  });
  const mutual = useQuery({ ...mutualFollowersQuery(userId), enabled: ownFollowers });
  const [selectedFilter, setFilter] = useState<"all" | "mutual">("all");
  const mutualIds = mutual.data ? new Set(mutual.data.map((person) => person.userId)) : null;
  const mutualError = mutual.isError && !mutual.isFetching ? "맞팔로우 목록을 확인하지 못했습니다. 전체 팔로워는 계속 볼 수 있습니다." : "";
  const filter = mutual.isError ? "all" : selectedFilter;

  // Posts listed on the profile are kept only while they still belong to its owner.
  const posts = articles.flatMap((article) => article.data && article.data.writer.userId === profile.userId ? [article.data] : []);
  const state = kind === "articles"
    ? articles.some((article) => article.isPending) ? "loading" : "ready"
    : relations.data ? "ready" : relations.isError && !relations.isFetching ? "error" : "loading";
  const error = kind === "articles"
    ? articles.some((article) => article.isError) ? "일부 게시글을 불러오지 못했습니다." : ""
    : state === "error"
      ? relations.error instanceof ApiError && relations.error.status === 403 ? "비공개 프로필의 관계 목록은 볼 수 없습니다." : "목록을 불러오지 못했습니다."
      : "";
  const retry = () => {
    if (kind !== "articles") void relations.refetch();
    else for (const article of articles) if (article.isError) void article.refetch();
  };
  const people = relations.data ?? [];
  const shownPeople = ownFollowers && filter === "mutual" ? people.filter((person) => mutualIds?.has(person.userId)) : people;
  const title = { followers: "팔로워", following: "팔로잉", articles: "게시글" }[kind];
  const emptyMessage =
    state === "ready" && !error && (kind === "articles" ? posts : shownPeople).length === 0
      ? kind === "articles" ? "작성한 게시글이 없습니다." : filter === "mutual" ? "맞팔로우한 팔로워가 없습니다." : `${title}가 없습니다.`
      : null;
  return {
    ownFollowers, filter, setFilter, mutualIds, mutualError, retryMutual: () => void mutual.refetch(),
    state, error, retry, posts, shownPeople, title, emptyMessage,
  };
}

export function ProfileListSheet({ kind, profile, onClose, onProfile, onPost }: ProfileListProps) {
  const { ownFollowers, filter, setFilter, mutualIds, mutualError, retryMutual, state, error, retry, posts, shownPeople, title, emptyMessage } =
    useProfileList(kind, profile);
  return (
    <FigmaSheet title={title} onClose={onClose}>
      <section className={profileStyles.profileListPanel}>
        <h1>{title}</h1>
        {ownFollowers && (
          <div role="group" aria-label="팔로워 필터" className={cn(filterChipRow, "mb-4")}>
            <button
              className={filterChip}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              전체
            </button>
            <button
              className={filterChip}
              aria-pressed={filter === "mutual"}
              disabled={mutualIds === null}
              onClick={() => setFilter("mutual")}
            >
              맞팔로우
            </button>
          </div>
        )}
        {ownFollowers && mutualIds === null && !mutualError && (
          <p role="status" className="py-6 text-center text-label leading-6 text-app-muted">
            맞팔로우 확인 중...
          </p>
        )}
        {ownFollowers && mutualError && (
          <div
            role="alert"
            className="my-3 flex flex-col items-center justify-center gap-3 rounded-xl border border-solid border-app-border px-4 py-5 text-center text-label leading-6 text-app-muted"
          >
            <p className="m-0">{mutualError}</p>
            <button
              className={buttonVariants({ tone: "secondary", size: "compact" })}
              onClick={retryMutual}
            >
              다시 확인
            </button>
          </div>
        )}
        {state === "loading" && (
          <p role="status" className="py-10 text-center text-label leading-6 text-app-muted">
            불러오는 중...
          </p>
        )}
        {error && (
          <div className="my-6 flex flex-col items-center justify-center gap-4 px-5 py-8 text-center text-label leading-6 text-app-muted">
            <p role="alert" className="m-0 text-[#ff8d8d]">
              {error}
            </p>
            {state !== "loading" && (
              <button className={buttonVariants({ tone: "secondary" })} onClick={retry}>
                다시 시도
              </button>
            )}
          </div>
        )}
        {kind === "articles" ? (
          <div className={communityStyles.miniPostList}>
            {posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={(id) => { onClose(); onPost(id); }} />)}
          </div>
        ) : state === "ready" && (
          <ul className={profileStyles.profilePeopleList}>{shownPeople.map((person) => <li key={person.userId}><button onClick={() => { onClose(); onProfile(person.userId); }}><Avatar src={person.profileImageUrl} /><span><strong>{person.nickname}</strong><small>{person.primaryInstrument || ""}</small></span></button></li>)}</ul>
        )}
        {emptyMessage && <p className={profileStyles.profileListEmpty}>{emptyMessage}</p>}
      </section>
    </FigmaSheet>
  );
}

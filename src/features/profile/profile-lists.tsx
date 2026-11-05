import { profileStyles } from "@/styles/profile.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useState } from "react";
import { FigmaSheet } from "@/components/figma-sheet";
import { Avatar } from "@/components/avatar";
import { MiniPost } from "@/features/posts/post-list";
import { fetchPost } from "@/lib/api/community";
import type { UserProfile, PostListItem } from "@/lib/api/contracts";
import { getMutualFollowers, getRelations, type Person } from "@/lib/api/social";
import { ApiError, apiOrigin } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export type ProfileListKind = "followers" | "following" | "articles";
type ProfileListProps = { kind: ProfileListKind; profile: UserProfile; onClose: () => void; onProfile: (id: number) => void; onPost: (id: number) => void };

export function ProfileListSheet(props: ProfileListProps) {
  const userId = useCurrentUserId();
  return <ScopedProfileListSheet key={JSON.stringify([apiOrigin(), userId, props.profile.userId, props.kind])} {...props} ownFollowers={userId === props.profile.userId && props.kind === "followers"} />;
}

function ScopedProfileListSheet({ kind, profile, onClose, onProfile, onPost, ownFollowers }: ProfileListProps & { ownFollowers: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<"all" | "mutual">("all");
  const [mutualIds, setMutualIds] = useState<Set<number> | null>(null);
  const [mutualError, setMutualError] = useState("");
  const [mutualRevision, setMutualRevision] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      if (kind === "articles") {
        const results = await Promise.allSettled(profile.activities.posts.map((post) => fetchPost(post.postId)));
        if (!active) return;
        setPosts(results.flatMap((result) => result.status === "fulfilled" && result.value.writer.userId === profile.userId ? [result.value] : []));
        if (results.some((result) => result.status === "rejected")) setError("일부 게시글을 불러오지 못했습니다.");
      } else {
        const result = await getRelations(profile.userId, kind);
        if (!active) return;
        setPeople(result);
      }
      setState("ready");
    })().catch((cause) => {
      if (!active) return;
      setState("error");
      setError(cause instanceof ApiError && cause.status === 403 ? "비공개 프로필의 관계 목록은 볼 수 없습니다." : "목록을 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, [kind, profile, revision]);

  useEffect(() => {
    if (!ownFollowers) return;
    let active = true;
    getMutualFollowers().then((result) => {
      if (active) setMutualIds(new Set(result.map((person) => person.userId)));
    }).catch(() => {
      if (active) {
        setMutualError("맞팔로우 목록을 확인하지 못했습니다. 전체 팔로워는 계속 볼 수 있습니다.");
        setFilter("all");
      }
    });
    return () => { active = false; };
  }, [ownFollowers, mutualRevision]);

  const shownPeople = ownFollowers && filter === "mutual" ? people.filter((person) => mutualIds?.has(person.userId)) : people;
  const title = { followers: "팔로워", following: "팔로잉", articles: "게시글" }[kind];
  return (
    <FigmaSheet title={title} onClose={onClose}>
      <section className={profileStyles.profileListPanel}>
        <h1>{title}</h1>
        {ownFollowers && <div role="group" aria-label="팔로워 필터"><button className={buttonVariants({ tone: filter === "all" ? "primary" : "secondary", size: "compact" })} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체</button><button className={buttonVariants({ tone: filter === "mutual" ? "primary" : "secondary", size: "compact" })} aria-pressed={filter === "mutual"} disabled={mutualIds === null} onClick={() => setFilter("mutual")}>맞팔로우</button></div>}
        {ownFollowers && mutualIds === null && !mutualError && <p role="status">맞팔로우 확인 중...</p>}
        {ownFollowers && mutualError && <div role="alert"><p>{mutualError}</p><button onClick={() => { setMutualIds(null); setMutualError(""); setMutualRevision((value) => value + 1); }}>다시 확인</button></div>}
        {state === "loading" && <p role="status">불러오는 중...</p>}
        {error && <p role="alert">{error}</p>}
        {state === "error" && <button onClick={() => { setState("loading"); setError(""); setRevision((value) => value + 1); }}>다시 시도</button>}
        {state === "ready" && (kind === "articles" ? <div className={communityStyles.miniPostList}>{posts.map((post) => <MiniPost key={post.postId} post={post} onOpen={(id) => { onClose(); onPost(id); }} />)}</div> : <ul className={profileStyles.profilePeopleList}>{shownPeople.map((person) => <li key={person.userId}><button onClick={() => { onClose(); onProfile(person.userId); }}><Avatar src={person.profileImageUrl} /><span><strong>{person.nickname}</strong><small>{person.primaryInstrument || ""}</small></span></button></li>)}</ul>)}
        {state === "ready" && (kind === "articles" ? posts : shownPeople).length === 0 && <p className={profileStyles.profileListEmpty}>{kind === "articles" ? "작성한 게시글이 없습니다." : filter === "mutual" ? "맞팔로우한 팔로워가 없습니다." : `${title}가 없습니다.`}</p>}
      </section>
    </FigmaSheet>
  );
}

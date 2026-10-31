import { profileStyles } from "@/styles/profile.styles";
import { communityStyles } from "@/styles/community.styles";
import { useEffect, useState } from "react";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { Avatar } from "@/components/app/shared";
import { MiniPost } from "@/features/posts/post-list";
import { fetchPost } from "@/lib/api/community";
import type { UserProfile, PostListItem } from "@/lib/api/contracts";
export type ProfileListKind = "followers" | "following" | "articles";
type Person = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  primaryInstrument?: string | null;
};
export function ProfileListSheet({
  kind,
  profile,
  onClose,
  onProfile,
  onPost,
}: {
  kind: ProfileListKind;
  profile: UserProfile;
  onClose: () => void;
  onProfile: (id: number) => void;
  onPost: (id: number) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]),
    [posts, setPosts] = useState<PostListItem[]>([]),
    [state, setState] = useState<"loading" | "ready" | "error">("loading"),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      if (kind === "articles") {
        const results = await Promise.allSettled(
          profile.activities.posts.map((post) => fetchPost(post.postId)),
        );
        if (!active) return;
        const found = results.flatMap((result) =>
          result.status === "fulfilled" && result.value.writer.userId === profile.userId
            ? [result.value]
            : [],
        );
        setPosts(found);
        if (results.some((result) => result.status === "rejected")) {
          setError("일부 게시글을 불러오지 못했습니다.");
        }
        setState("ready");
        return;
      }
      const relations = profile.relations as UserProfile["relations"] & {
        followers?: Person[];
        following?: Person[];
      };
      if (Array.isArray(relations[kind])) {
        if (active) {
          setPeople(relations[kind]!);
          setState("ready");
        }
        return;
      }
      const count =
        kind === "followers" ? profile.relations.followerCount : profile.relations.followingCount;
      if (active) {
        if (count === 0) setState("ready");
        else {
          setError("사용자 목록 API 연결이 필요합니다.");
          setState("error");
        }
      }
    })().catch(() => {
      if (active) {
        setState("error");
        setError("목록을 불러오지 못했습니다.");
      }
    });
    return () => {
      active = false;
    };
  }, [kind, profile]);
  const title = { followers: "팔로워", following: "팔로잉", articles: "게시글" }[kind];
  return (
    <FigmaSheet title={title} onClose={onClose}>
      <section className={profileStyles.profileListPanel}>
        <h1>{title}</h1>
        {state === "loading" && <p role="status">불러오는 중...</p>}
        {error && <p role="alert">{error}</p>}
        {kind === "articles" ? (
          <div className={communityStyles.miniPostList}>
            {posts.map((post) => (
              <MiniPost
                key={post.postId}
                post={post}
                onOpen={(id) => {
                  onClose();
                  onPost(id);
                }}
              />
            ))}
          </div>
        ) : (
          <ul className={profileStyles.profilePeopleList}>
            {people.map((person) => (
              <li key={person.userId}>
                <button
                  onClick={() => {
                    onClose();
                    onProfile(person.userId);
                  }}
                >
                  <Avatar src={person.profileImageUrl} />
                  <span>
                    <strong>{person.nickname}</strong>
                    <small>{person.primaryInstrument || ""}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {state === "ready" && (kind === "articles" ? posts : people).length === 0 && (
          <p className={profileStyles.profileListEmpty}>
            {kind === "articles" ? "작성한 게시글이 없습니다." : `${title}가 없습니다.`}
          </p>
        )}
      </section>
    </FigmaSheet>
  );
}

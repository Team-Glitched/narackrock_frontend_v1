import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import { profileStyles } from "@/styles/profile.styles";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SectionTitle } from "@/components/ui/section-title";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { relationError } from "@/features/profile/profile-relations";
import {
  followPerson,
  getFollowRequests,
  getMutualFollowers,
  getRecommendations,
  reviewFollowRequest,
  unfollowPerson,
  type FollowRequest,
  type Person,
  type RecommendedPerson,
} from "@/lib/api/social";

type Loaded = { key: string; mutual: Person[]; recommended: RecommendedPerson[]; requests: FollowRequest[]; error?: string };

function PersonLink({ person, onProfile }: { person: Pick<Person, "userId" | "nickname" | "profileImageUrl" | "primaryInstrument">; onProfile: (id: number) => void }) {
  return (
    <button className={socialStyles.personLink} onClick={() => onProfile(person.userId)}>
      <Avatar src={person.profileImageUrl} />
      <span>
        <strong>{person.nickname}</strong>
        <small>{person.primaryInstrument ?? ""}</small>
      </span>
    </button>
  );
}

export function FriendsScreen({ onProfile, onChat }: { onProfile: (id: number) => void; onChat: (id: number) => void }) {
  const userId = useCurrentUserId();
  const [revision, setRevision] = useState(0);
  const key = `${userId}:${revision}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [following, setFollowing] = useState<Record<number, "FOLLOWING" | "PENDING" | null>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    Promise.all([getMutualFollowers(), getRecommendations(), getFollowRequests()])
      .then(([mutual, recommended, requests]) => {
        if (active) setLoaded({ key, mutual, recommended: recommended.recommendedUsers, requests });
      })
      .catch((cause) => {
        if (active) setLoaded({ key, mutual: [], recommended: [], requests: [], error: relationError(cause, "친구 정보를 불러오지 못했습니다.") });
      });
    return () => {
      active = false;
    };
  }, [key, userId]);
  if (userId === null) return <SignInRequired>친구 기능은 로그인 후 사용할 수 있습니다.</SignInRequired>;
  const current = loaded?.key === key ? loaded : null;
  async function act(id: number, action: () => Promise<void>) {
    if (busy !== null) return;
    setBusy(id);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setNotice(relationError(cause, "요청을 처리하지 못했습니다."));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className={cn(socialStyles.friendsView, sharedStyles.scrollContent)}>
      {!current && <p role="status">친구 정보를 불러오는 중...</p>}
      {current?.error && (
        <div role="alert">
          <p>{current.error}</p>
          <button onClick={() => setRevision((value) => value + 1)}>다시 시도</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className={"mutual-friends"}>
        <SectionTitle>맞팔로우</SectionTitle>
        {current && current.mutual.length === 0 && <p>아직 맞팔로우한 친구가 없습니다.</p>}
        <div className={socialStyles.mutualFriendRail}>
          {current?.mutual.map((person) => (
            <article className={socialStyles.mutualFriendCard} key={person.userId}>
              <button className={socialStyles.mutualFriendIdentity} aria-label={`${person.nickname} 프로필`} onClick={() => onProfile(person.userId)}>
                <Avatar src={person.profileImageUrl} />
                <strong>{person.nickname}</strong>
                <small>{person.primaryInstrument ?? ""}</small>
              </button>
              <button className={buttonVariants({ tone: "primary" })} onClick={() => onChat(person.userId)}>
                채팅
              </button>
            </article>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 추천</SectionTitle>
        {current && current.recommended.length === 0 && <p>추천할 사용자가 없습니다.</p>}
        <div className={profileStyles.peopleList}>
          {current?.recommended.map((person) => {
            const state = following[person.userId] ?? (person.isFollowing ? "FOLLOWING" : null);
            return (
              <div className={socialStyles.person} key={person.userId}>
                <PersonLink person={person} onProfile={onProfile} />
                <button
                  className={buttonVariants({ tone: state ? "secondary" : "primary" })}
                  aria-pressed={state !== null}
                  disabled={busy !== null}
                  onClick={() =>
                    void act(person.userId, async () => {
                      if (state) {
                        await unfollowPerson(person.userId);
                        setFollowing((old) => ({ ...old, [person.userId]: null }));
                      } else {
                        const result = await followPerson(person.userId);
                        setFollowing((old) => ({ ...old, [person.userId]: result.status }));
                      }
                    })
                  }
                >
                  {state === "FOLLOWING" ? "팔로잉" : state === "PENDING" ? "요청됨" : "팔로우"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 요청</SectionTitle>
        {current && current.requests.length === 0 && <p>받은 팔로우 요청이 없습니다.</p>}
        <div className={profileStyles.peopleList}>
          {current?.requests.map((request) => (
            <div className={socialStyles.person} key={request.requestId}>
              <PersonLink person={{ ...request, userId: request.requesterId }} onProfile={onProfile} />
              <button
                className={buttonVariants({ tone: "primary", size: "compact" })}
                disabled={busy !== null}
                onClick={() =>
                  void act(request.requestId, async () => {
                    await reviewFollowRequest(request.requestId, "accept");
                    setRevision((value) => value + 1);
                  })
                }
              >
                수락
              </button>
              <button
                className={buttonVariants({ tone: "secondary" })}
                disabled={busy !== null}
                onClick={() =>
                  void act(request.requestId, async () => {
                    await reviewFollowRequest(request.requestId, "reject");
                    setRevision((value) => value + 1);
                  })
                }
              >
                거절
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

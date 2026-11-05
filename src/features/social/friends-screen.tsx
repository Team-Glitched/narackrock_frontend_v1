import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import { profileStyles } from "@/styles/profile.styles";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SectionTitle } from "@/components/ui/section-title";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { relationError } from "@/features/profile/profile-relations";
import { apiOrigin } from "@/lib/api/client";
import { getFollowRequests, getMutualFollowers, reviewFollowRequest, type FollowRequest, type Person } from "@/lib/api/social";
import { RecommendedPeopleList } from "./recommended-people-list";

type FriendsProps = { onProfile: (id: number) => void; onChat: (id: number) => void; view?: "summary" | "recommendations"; onRecommendations?: () => void };
type Loaded = { mutual: Person[]; requests: FollowRequest[]; error?: string };

function PersonLink({ person, onProfile }: { person: Pick<Person, "userId" | "nickname" | "profileImageUrl" | "primaryInstrument">; onProfile: (id: number) => void }) {
  return <button className={socialStyles.personLink} onClick={() => onProfile(person.userId)}><Avatar src={person.profileImageUrl} /><span><strong>{person.nickname}</strong><small>{person.primaryInstrument ?? ""}</small></span></button>;
}

export function FriendsScreen(props: FriendsProps) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>친구 기능은 로그인 후 사용할 수 있습니다.</SignInRequired>;
  return <ScopedFriendsScreen key={JSON.stringify([apiOrigin(), userId])} {...props} />;
}

function ScopedFriendsScreen({ onProfile, onChat, view = "summary", onRecommendations }: FriendsProps) {
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    let active = true;
    if (view === "recommendations") return;
    Promise.all([getMutualFollowers(), getFollowRequests()])
      .then(([mutual, requests]) => { if (active) setLoaded({ mutual, requests }); })
      .catch((cause) => { if (active) setLoaded({ mutual: [], requests: [], error: relationError(cause, "친구 정보를 불러오지 못했습니다.") }); });
    return () => { active = false; };
  }, [revision, view]);

  async function review(requestId: number, decision: "accept" | "reject") {
    if (busy) return;
    const epoch = generation.current;
    setBusy(true);
    setNotice("");
    try {
      await reviewFollowRequest(requestId, decision);
      if (generation.current === epoch) setRevision((value) => value + 1);
    } catch (cause) {
      if (generation.current === epoch) setNotice(relationError(cause, "요청을 처리하지 못했습니다."));
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }

  return (
    <div className={cn(socialStyles.friendsView, sharedStyles.scrollContent)}>
      {view === "summary" && <>
        {!loaded && <p role="status">친구 정보를 불러오는 중...</p>}
        {loaded?.error && <div role="alert"><p>{loaded.error}</p><button onClick={() => setRevision((value) => value + 1)}>다시 시도</button></div>}
        {notice && <p role="status">{notice}</p>}
        <section className="mutual-friends">
          <SectionTitle>맞팔로우</SectionTitle>
          {loaded && !loaded.error && loaded.mutual.length === 0 && <p>아직 맞팔로우한 친구가 없습니다.</p>}
          <div className={socialStyles.mutualFriendRail}>{loaded?.mutual.map((person) => <article className={socialStyles.mutualFriendCard} key={person.userId}><button className={socialStyles.mutualFriendIdentity} aria-label={`${person.nickname} 프로필`} onClick={() => onProfile(person.userId)}><Avatar src={person.profileImageUrl} /><strong>{person.nickname}</strong><small>{person.primaryInstrument ?? ""}</small></button><button className={buttonVariants({ tone: "primary" })} onClick={() => onChat(person.userId)}>채팅</button></article>)}</div>
        </section>
      </>}
      <RecommendedPeopleList full={view === "recommendations"} onProfile={onProfile} onAll={onRecommendations} />
      {view === "summary" && <section>
        <SectionTitle>팔로우 요청</SectionTitle>
        {loaded && !loaded.error && loaded.requests.length === 0 && <p>받은 팔로우 요청이 없습니다.</p>}
        <div className={profileStyles.peopleList}>{loaded?.requests.map((request) => <div className={socialStyles.person} key={request.requestId}><PersonLink person={{ ...request, userId: request.requesterId }} onProfile={onProfile} /><button className={buttonVariants({ tone: "primary", size: "compact" })} disabled={busy} onClick={() => void review(request.requestId, "accept")}>수락</button><button className={buttonVariants({ tone: "secondary" })} disabled={busy} onClick={() => void review(request.requestId, "reject")}>거절</button></div>)}</div>
      </section>}
    </div>
  );
}

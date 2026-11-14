import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import { profileStyles } from "@/styles/profile.styles";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { SectionTitle } from "@/components/section-title";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { relationError } from "@/features/profile/profile-relations";
import type { Person } from "@/lib/api/social";
import { RecommendedPeopleList } from "./recommended-people-list";
import { followRequestsQuery, mutualFollowersQuery, useReviewFollowRequestMutation } from "./social-queries";

type ProfileHandler = (id: number) => void;
type ChatHandler = (userId: number) => void;

/** The friends tab shows this many of each list; "모두보기" opens the full list on its own page. */
const MUTUAL_PREVIEW = 6;
const REQUEST_PREVIEW = 3;

function PersonLink({ person, onProfile }: { person: Pick<Person, "userId" | "nickname" | "profileImageUrl" | "primaryInstrument">; onProfile: ProfileHandler }) {
  return <button className={socialStyles.personLink} onClick={() => onProfile(person.userId)}><Avatar size="md" src={person.profileImageUrl} /><span><strong className="truncate">{person.nickname}</strong><small className="truncate">{person.primaryInstrument ?? ""}</small></span></button>;
}

function SignedIn({ children }: { children: (userId: number) => ReactNode }) {
  const userId = useCurrentUserId();
  if (userId === null) return <SignInRequired>친구 기능은 로그인 후 사용할 수 있습니다.</SignInRequired>;
  return <div className={cn(socialStyles.friendsView, sharedStyles.scrollContent)}>{children(userId)}</div>;
}

function MutualFriends({ userId, full, onProfile, onChat, onAll }: { userId: number; full: boolean; onProfile: ProfileHandler; onChat: ChatHandler; onAll?: () => void }) {
  const query = useQuery(mutualFollowersQuery(userId));
  const people = query.data ?? [];
  return (
    <section className={cn("mutual-friends", socialStyles.friendsSection)} aria-label="맞팔로우">
      <SectionTitle className="px-0" onAll={full ? undefined : onAll}>맞팔로우</SectionTitle>
      {query.isPending && <p className={socialStyles.friendsEmpty} role="status">맞팔로우를 불러오는 중...</p>}
      {query.isError && <div role="alert"><p>{relationError(query.error, "맞팔로우를 불러오지 못했습니다.")}</p><button disabled={query.isFetching} onClick={() => void query.refetch()}>다시 시도</button></div>}
      {query.isSuccess && people.length === 0 && <p className={socialStyles.friendsEmpty}>아직 맞팔로우한 친구가 없습니다.</p>}
      {full ? (
        <div className={profileStyles.peopleList}>{people.map((person) => <div className={socialStyles.person} key={person.userId}><PersonLink person={person} onProfile={onProfile} /><button className={buttonVariants({ tone: "primary" })} onClick={() => onChat(person.userId)}>채팅</button></div>)}</div>
      ) : (
        <div className={socialStyles.mutualFriendRail}>{people.slice(0, MUTUAL_PREVIEW).map((person) => <article className={socialStyles.mutualFriendCard} key={person.userId}><button className={socialStyles.mutualFriendIdentity} aria-label={`${person.nickname} 프로필`} onClick={() => onProfile(person.userId)}><Avatar src={person.profileImageUrl} /><strong>{person.nickname}</strong><small>{person.primaryInstrument ?? ""}</small></button><button className={buttonVariants({ tone: "primary" })} onClick={() => onChat(person.userId)}>채팅</button></article>)}</div>
      )}
    </section>
  );
}

function FollowRequests({ userId, full, onProfile, onAll }: { userId: number; full: boolean; onProfile: ProfileHandler; onAll?: () => void }) {
  const query = useQuery(followRequestsQuery(userId));
  const review = useReviewFollowRequestMutation();
  const [notice, setNotice] = useState("");
  const busy = review.isPending;
  const requests = query.data ?? [];

  function decide(requestId: number, decision: "accept" | "reject") {
    if (busy) return;
    setNotice("");
    review.mutate({ requestId, decision }, {
      onError: (cause) => setNotice(relationError(cause, "요청을 처리하지 못했습니다.")),
    });
  }

  return (
    <section className={socialStyles.friendsSection} aria-label="팔로우 요청">
      <SectionTitle className="px-0" onAll={full ? undefined : onAll}>팔로우 요청</SectionTitle>
      {notice && <p role="status">{notice}</p>}
      {query.isPending && <p className={socialStyles.friendsEmpty} role="status">팔로우 요청을 불러오는 중...</p>}
      {query.isError && <div role="alert"><p>{relationError(query.error, "팔로우 요청을 확인하지 못했습니다.")}</p><button disabled={query.isFetching} onClick={() => void query.refetch()}>다시 시도</button></div>}
      {query.isSuccess && requests.length === 0 && <p className={socialStyles.friendsEmpty}>받은 팔로우 요청이 없습니다.</p>}
      <div className={profileStyles.peopleList}>{(full ? requests : requests.slice(0, REQUEST_PREVIEW)).map((request) => <div className={socialStyles.person} key={request.requestId}><PersonLink person={{ ...request, userId: request.requesterId }} onProfile={onProfile} /><button className={buttonVariants({ tone: "primary", size: "compact" })} disabled={busy} onClick={() => decide(request.requestId, "accept")}>수락</button><button className={buttonVariants({ tone: "secondary" })} disabled={busy} onClick={() => decide(request.requestId, "reject")}>거절</button></div>)}</div>
    </section>
  );
}

export type FriendsListKind = "mutual" | "recommendations" | "requests";

export function FriendsScreen({ onProfile, onChat, onOpenList }: { onProfile: ProfileHandler; onChat: ChatHandler; onOpenList?: (kind: FriendsListKind) => void }) {
  const open = (kind: FriendsListKind) => (onOpenList ? () => onOpenList(kind) : undefined);
  return (
    <SignedIn>
      {(userId) => <>
        <MutualFriends userId={userId} full={false} onProfile={onProfile} onChat={onChat} onAll={open("mutual")} />
        <RecommendedPeopleList full={false} onProfile={onProfile} onAll={open("recommendations")} />
        <FollowRequests userId={userId} full={false} onProfile={onProfile} onAll={open("requests")} />
      </>}
    </SignedIn>
  );
}

/** Separate page behind each friends-tab "모두보기"; the header back button returns to the friends tab. */
export function FriendsListScreen({ kind, onProfile, onChat }: { kind: FriendsListKind; onProfile: ProfileHandler; onChat: ChatHandler }) {
  return (
    <SignedIn>
      {(userId) => kind === "mutual" ? <MutualFriends userId={userId} full onProfile={onProfile} onChat={onChat} />
        : kind === "requests" ? <FollowRequests userId={userId} full onProfile={onProfile} />
          : <RecommendedPeopleList full onProfile={onProfile} />}
    </SignedIn>
  );
}

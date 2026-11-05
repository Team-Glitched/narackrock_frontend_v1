import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SectionTitle } from "@/components/ui/section-title";
import { relationError } from "@/features/profile/profile-relations";
import { followPerson, getOutgoingFollowRequests, getRecommendations, unfollowPerson, type OutgoingRequest } from "@/lib/api/social";
import { profileStyles } from "@/styles/profile.styles";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import { loadRecommendationPrefix, mergeRecommendedPeople, recommendationFollowState, recommendationsHaveMore, RecommendationRequests, RECOMMENDATION_PAGE_SIZE, type FollowState, type RecommendationPage } from "./recommendations";

/** The parent keys this component by origin/account, discarding every request and local mutation on scope change. */
export function RecommendedPeopleList({ full, onProfile, onAll }: { full: boolean; onProfile: (id: number) => void; onAll?: () => void }) {
  const [pages, setPages] = useState<RecommendationPage[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[] | null>(null);
  const [outgoingError, setOutgoingError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, FollowState>>({});
  const [requests] = useState(() => new RecommendationRequests());
  const locked = useRef(false);

  async function checkOutgoing() {
    const isCurrent = requests.capture();
    setChecking(true);
    setOutgoingError("");
    try {
      const result = await getOutgoingFollowRequests();
      if (isCurrent()) setOutgoing(result);
    } catch (cause) {
      if (isCurrent()) {
        setOutgoing(null);
        setOutgoingError(relationError(cause, "보낸 팔로우 요청 확인에 실패했습니다."));
      }
    } finally {
      if (isCurrent()) setChecking(false);
    }
  }

  async function loadFirst() {
    const isCurrent = requests.capture();
    setLoading(true);
    setError("");
    try {
      const result = await getRecommendations(0, RECOMMENDATION_PAGE_SIZE);
      if (isCurrent()) setPages([result]);
    } catch (cause) {
      if (isCurrent()) setError(relationError(cause, "추천을 불러오지 못했습니다."));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  useEffect(() => {
    void loadFirst();
    void checkOutgoing();
    return () => { requests.invalidate(); };
  }, []);

  async function synchronize() {
    const isCurrent = requests.capture();
    setSyncing(true);
    try {
      const [nextPages, nextOutgoing] = await Promise.all([
        loadRecommendationPrefix(Math.max(0, pages.length - 1), getRecommendations),
        getOutgoingFollowRequests(),
      ]);
      if (!isCurrent()) return;
      setPages(nextPages);
      setOutgoing(nextOutgoing);
      setOutgoingError("");
      setError("");
      setStale(false);
    } catch (cause) {
      if (isCurrent()) {
        setStale(true);
        setError(relationError(cause, "추천 목록 동기화에 실패했습니다."));
      }
    } finally {
      if (isCurrent()) setSyncing(false);
    }
  }

  async function change(id: number, state: FollowState) {
    if (locked.current || !outgoing || checking || loading || syncing || stale) return;
    const isCurrent = requests.capture();
    locked.current = true;
    setBusy(id);
    setNotice("");
    try {
      let next: FollowState = null;
      if (state) await unfollowPerson(id);
      else next = (await followPerson(id)).status;
      if (!isCurrent()) return;
      setOverrides((old) => ({ ...old, [id]: next }));
      setNotice(next === "PENDING" ? "팔로우를 요청했습니다." : state === "PENDING" ? "팔로우 요청을 취소했습니다." : "팔로우 상태를 변경했습니다.");
      await synchronize();
    } catch (cause) {
      if (isCurrent()) setNotice(relationError(cause, "팔로우 상태를 바꾸지 못했습니다."));
    } finally {
      if (isCurrent()) {
        locked.current = false;
        setBusy(null);
      }
    }
  }

  async function more() {
    if (locked.current || loading || syncing || stale || pages.length === 0) return;
    const isCurrent = requests.capture();
    locked.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await getRecommendations(pages.length, RECOMMENDATION_PAGE_SIZE);
      if (isCurrent()) setPages((old) => [...old, result]);
    } catch (cause) {
      if (isCurrent()) setError(relationError(cause, "다음 추천을 불러오지 못했습니다."));
    } finally {
      if (isCurrent()) {
        locked.current = false;
        setLoading(false);
      }
    }
  }

  const people = mergeRecommendedPeople(pages);
  const visible = full ? people : people.slice(0, 6);
  const last = pages.at(-1);
  const hasMore = Boolean(last && recommendationsHaveMore(pages.length - 1, last.totalCount));
  return (
    <section>
      <SectionTitle>팔로우 추천</SectionTitle>
      {!full && onAll && <button className={buttonVariants({ tone: "secondary", size: "compact" })} onClick={onAll}>모두보기</button>}
      {checking && <p role="status">보낸 팔로우 요청 확인 중...</p>}
      {outgoingError && <div role="alert"><p>확인 실패: {outgoingError}</p><button disabled={checking} onClick={() => void checkOutgoing()}>다시 확인</button></div>}
      {error && <div role="alert"><p>{error}</p>{stale && <p>목록이 최신 상태가 아닙니다. 동기화 후 더 불러올 수 있습니다.</p>}<button disabled={loading || syncing || busy !== null} onClick={() => void (stale ? synchronize() : pages.length ? more() : loadFirst())}>{stale ? "다시 동기화" : "다시 시도"}</button></div>}
      {notice && <p role="status">{notice}</p>}
      {(loading || syncing) && <p role="status">{syncing ? "추천 목록 동기화 중..." : "추천을 불러오는 중..."}</p>}
      {!loading && !error && people.length === 0 && <p>추천할 사용자가 없습니다.</p>}
      <div className={profileStyles.peopleList}>
        {visible.map((person) => {
          const state = recommendationFollowState(person, outgoing ?? [], overrides);
          const known = outgoing !== null && !checking;
          return (
            <div className={socialStyles.person} key={person.userId}>
              <button className={socialStyles.personLink} onClick={() => onProfile(person.userId)}><Avatar src={person.profileImageUrl} /><span><strong>{person.nickname}</strong><small>{person.primaryInstrument ?? ""}</small></span></button>
              <button className={buttonVariants({ tone: state ? "secondary" : "primary" })} disabled={!known || loading || syncing || stale || busy !== null} aria-pressed={known ? state !== null : undefined} aria-label={`${person.nickname} ${!known ? "팔로우 상태 확인" : state === "PENDING" ? "요청 취소" : state === "FOLLOWING" ? "팔로우 해제" : "팔로우"}`} onClick={() => void change(person.userId, state)}>{!known ? "확인 중" : state === "FOLLOWING" ? "팔로잉" : state === "PENDING" ? "요청됨" : "팔로우"}</button>
            </div>
          );
        })}
      </div>
      {full && hasMore && <button className={buttonVariants({ tone: "secondary" })} disabled={loading || syncing || stale || busy !== null} onClick={() => void more()}>더보기</button>}
    </section>
  );
}

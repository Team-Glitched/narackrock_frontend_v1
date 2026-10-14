"use client";

import { useEffect, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { getContributionInbox, reviewContribution, type ContributionNotificationDto } from "@/lib/api/composition";
import { getFollowRequests, reviewFollowRequest, type FollowRequest } from "@/lib/api/social";

export function NotificationsScreen({ onBack, onOpenProject }: {
  onBack: () => void;
  onOpenProject: (projectId: number) => void;
}) {
  const [items, setItems] = useState<ContributionNotificationDto[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getContributionInbox().then((result) => { if (!cancelled) setItems(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "알림을 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    getFollowRequests().then((result) => { if (!cancelled) setFollowRequests(result); })
      .catch(() => { if (!cancelled) setError("팔로우 요청을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, []);

  async function review(item: ContributionNotificationDto, decision: "APPROVED" | "REJECTED") {
    if (busyId !== null) return;
    setBusyId(item.contributionId); setError(null); setNotice(null);
    try {
      await reviewContribution(item.projectId, item.contributionId, decision);
      setItems((current) => current.filter((entry) => entry.contributionId !== item.contributionId));
      window.dispatchEvent(new Event("social-notifications-changed"));
      setNotice(decision === "APPROVED"
        ? "기여를 승인했습니다. 갱신된 음원이 곧 숏폼에 반영됩니다."
        : "기여를 거부했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "기여 요청을 처리하지 못했습니다."); }
    finally { setBusyId(null); }
  }

  async function reviewFollow(item: FollowRequest, decision: "accept" | "reject") {
    if (busyId !== null) return;
    setBusyId(item.requestId); setError(null); setNotice(null);
    try {
      await reviewFollowRequest(item.requestId, decision);
      setFollowRequests(current => current.filter(entry => entry.requestId !== item.requestId));
      setNotice(decision === "accept" ? "팔로우 요청을 승인했습니다." : "팔로우 요청을 거절했습니다.");
      window.dispatchEvent(new Event("social-notifications-changed"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "팔로우 요청을 처리하지 못했습니다."); }
    finally { setBusyId(null); }
  }

  return <div className="notifications-screen scroll-content">
    <div className="back-title"><button aria-label="뒤로" onClick={onBack}><Asset name="return.svg" /></button><h1>알림</h1></div>
    <h2>작곡 참여 요청</h2>
    {error && <p className="notification-error" role="alert">{error}</p>}
    {notice && <p className="notification-notice" role="status">{notice}</p>}
    {loading ? <p className="notification-empty">알림을 불러오는 중입니다.</p>
      : items.length === 0 ? <p className="notification-empty">대기 중인 작곡 참여 요청이 없습니다.</p>
        : <ul className="notification-list">{items.map((item) => <li key={item.contributionId} className="notification-card">
          <strong>{item.nickname}님의 작곡 참여 요청</strong>
          <span>{item.projectTitle}</span>
          {item.description && <p>“{item.description}”</p>}
          <small>{item.itemCount}개 항목이 승인 대기 중입니다.</small>
          <div>
            <button className="notification-open" onClick={() => onOpenProject(item.projectId)}>곡 바로가기</button>
            <button onClick={() => { void review(item, "APPROVED"); }} disabled={busyId !== null}>승인</button>
            <button onClick={() => { void review(item, "REJECTED"); }} disabled={busyId !== null}>거부</button>
          </div>
        </li>)}</ul>}
    <h2>팔로우 요청</h2>
    {followRequests.length === 0 ? <p className="notification-empty">대기 중인 팔로우 요청이 없습니다.</p>
      : <ul className="notification-list">{followRequests.map(item => <li key={item.requestId} className="notification-card">
        <div className="notification-person"><Avatar src={item.profileImageUrl} /><strong>{item.nickname}님의 팔로우 요청</strong></div>
        {item.primaryInstrument && <span>{item.primaryInstrument}</span>}
        <div><button onClick={() => void reviewFollow(item, "accept")} disabled={busyId !== null}>승인</button><button onClick={() => void reviewFollow(item, "reject")} disabled={busyId !== null}>거절</button></div>
      </li>)}</ul>}
  </div>;
}

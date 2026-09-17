"use client";

import "./community.css";
import type { Navigate } from "@/features/navigation/types";
import type { Community } from "./community-card";
import { CommunityCard, CommunityRailCard, useCommunityMembership } from "./community-card";

// Design examples only: gallery discovery/subscription endpoints do not exist yet.
// Keep these separate from the post API contracts and never persist membership.
const description = "이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다";

export const joinedCommunities: Community[] = [
  { galleryId: 1, name: "Muhehehe", memberCount: 100, description, imageUrl: null },
  { galleryId: 2, name: "min chong", memberCount: 342, description, imageUrl: null },
  { galleryId: 3, name: "lilia", memberCount: 87, description, imageUrl: null },
  { galleryId: 4, name: "jayden", memberCount: 1204, description, imageUrl: null },
  { galleryId: 5, name: "soyeon", memberCount: 56, description, imageUrl: null },
  { galleryId: 6, name: "nara", memberCount: 913, description, imageUrl: null },
];

export const recommendedCommunities: Community[] = [
  { galleryId: 101, name: "Muhehehe", memberCount: 100, description, imageUrl: null },
  { galleryId: 102, name: "밤작업실", memberCount: 428, description, imageUrl: null },
  { galleryId: 103, name: "신스 러버", memberCount: 76, description, imageUrl: null },
  { galleryId: 104, name: "로파이 클럽", memberCount: 2317, description, imageUrl: null },
];

const previewNotice = "디자인 확인용 예시입니다. 커뮤니티 목록과 가입 기능은 준비 중이에요.";

export function CommunityDirectory({ go }: { go: Navigate }) {
  const membership = useCommunityMembership(joinedCommunities.map(community => community.galleryId));

  return (
    <div className="community-directory">
      <section aria-labelledby="joined-communities-heading">
        <div className="directory-heading">
          <h2 id="joined-communities-heading">가입한 커뮤니티 <small>예시</small></h2>
          <button onClick={() => go("joined")}>모두보기</button>
        </div>
        <ul className="community-rail" tabIndex={0} aria-label="가입한 커뮤니티 예시 목록">
          {joinedCommunities.slice(0, 4).map(community => (
            <CommunityRailCard
              key={community.galleryId}
              community={community}
              joined={membership.isJoined(community.galleryId)}
              onToggle={() => membership.toggle(community.galleryId)}
            />
          ))}
        </ul>
      </section>

      <section className="recommended-communities" aria-labelledby="recommended-communities-heading">
        <div className="directory-heading"><h2 id="recommended-communities-heading">추천 커뮤니티</h2></div>
        <ul className="community-card-list" aria-label="추천 커뮤니티 예시 목록">
          {recommendedCommunities.map(community => (
            <CommunityCard
              key={community.galleryId}
              community={community}
              joined={membership.isJoined(community.galleryId)}
              onToggle={() => membership.toggle(community.galleryId)}
            />
          ))}
        </ul>
      </section>
      <p className="directory-preview-notice">{previewNotice}</p>
    </div>
  );
}

// Community.pdf의 "가입한 커뮤니티" 전체 목록 화면.
// 뒤로가기/알림/검색/프로필 헤더는 page.tsx의 공용 Header가 그린다.
export function JoinedCommunitiesScreen() {
  const membership = useCommunityMembership(joinedCommunities.map(community => community.galleryId));

  return (
    <div className="joined-view scroll-content">
      <h1 className="joined-title">가입한 커뮤니티</h1>
      <ul className="community-card-list" aria-label="가입한 커뮤니티 목록">
        {joinedCommunities.map(community => (
          <CommunityCard
            key={community.galleryId}
            community={community}
            joined={membership.isJoined(community.galleryId)}
            onToggle={() => membership.toggle(community.galleryId)}
            headingLevel={2}
          />
        ))}
      </ul>
      <p className="directory-preview-notice">{previewNotice}</p>
    </div>
  );
}

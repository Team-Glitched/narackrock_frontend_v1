"use client";

import "./community.css";
import type { Navigate } from "@/features/navigation/types";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import type { Community } from "./community-card";
import { CommunityCard, CommunityRailCard } from "./community-card";
import { useCommunityMembership } from "./community-membership";

// Design examples only: gallery discovery/subscription endpoints do not exist yet.
// Keep these separate from the post API contracts and never persist membership.
const description = "이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다";

// 갤러리 목록 API가 없어 커뮤니티마다 고유한 갤러리를 줄 수 없다. 예시 커뮤니티는
// 모두 기본 갤러리를 가리켜, 어느 카드를 열어도 게시글 화면이 정상 동작하게 한다.
// 갤러리 목록 API가 생기면 이 상수 대신 서버가 준 galleryId를 넣으면 된다.
const galleryId = DEFAULT_GALLERY_ID;

export const joinedCommunities: Community[] = [
  { id: 1, galleryId, name: "Muhehehe", memberCount: 100, description, imageUrl: null },
  { id: 2, galleryId, name: "min chong", memberCount: 342, description, imageUrl: null },
  { id: 3, galleryId, name: "lilia", memberCount: 87, description, imageUrl: null },
  { id: 4, galleryId, name: "jayden", memberCount: 1204, description, imageUrl: null },
  { id: 5, galleryId, name: "soyeon", memberCount: 56, description, imageUrl: null },
  { id: 6, galleryId, name: "nara", memberCount: 913, description, imageUrl: null },
];

export const recommendedCommunities: Community[] = [
  { id: 101, galleryId, name: "Muhehehe", memberCount: 100, description, imageUrl: null },
  { id: 102, galleryId, name: "밤작업실", memberCount: 428, description, imageUrl: null },
  { id: 103, galleryId, name: "신스 러버", memberCount: 76, description, imageUrl: null },
  { id: 104, galleryId, name: "로파이 클럽", memberCount: 2317, description, imageUrl: null },
];

const previewNotice = "디자인 확인용 예시입니다. 커뮤니티 목록과 가입 기능은 준비 중이에요.";

// Provider 초깃값. 매 렌더 새 배열이 만들어지지 않도록 모듈 상수로 둔다.
export const defaultJoinedCommunityIds: readonly number[] = joinedCommunities.map(community => community.id);

// 가입/탈퇴 실패는 세 화면이 같은 자리에서 알린다.
function MembershipError() {
  const { error } = useCommunityMembership();
  return error ? <p className="membership-error" role="alert">{error}</p> : null;
}

export function CommunityDirectory({ go, onOpen }: { go: Navigate; onOpen: (community: Community) => void }) {
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
              key={community.id}
              community={community}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </section>

      <section className="recommended-communities" aria-labelledby="recommended-communities-heading">
        <div className="directory-heading"><h2 id="recommended-communities-heading">추천 커뮤니티</h2></div>
        <ul className="community-card-list" aria-label="추천 커뮤니티 예시 목록">
          {recommendedCommunities.map(community => (
            <CommunityCard
              key={community.id}
              community={community}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </section>
      <MembershipError />
      <p className="directory-preview-notice">{previewNotice}</p>
    </div>
  );
}

// Community.pdf의 "가입한 커뮤니티" 전체 목록 화면.
// 뒤로가기/알림/검색/프로필 헤더는 page.tsx의 공용 Header가 그린다.
export function JoinedCommunitiesScreen({ onOpen }: { onOpen: (community: Community) => void }) {
  return (
    <div className="joined-view scroll-content">
      <h1 className="joined-title">가입한 커뮤니티</h1>
      <ul className="community-card-list" aria-label="가입한 커뮤니티 목록">
        {joinedCommunities.map(community => (
          <CommunityCard
            key={community.id}
            community={community}
            onOpen={onOpen}
            headingLevel={2}
          />
        ))}
      </ul>
      <MembershipError />
      <p className="directory-preview-notice">{previewNotice}</p>
    </div>
  );
}

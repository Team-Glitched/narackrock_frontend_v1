"use client";

import { Avatar } from "@/components/app/shared";
import { useCommunityMembership } from "./community-membership";

// 가입한 커뮤니티 / 추천 커뮤니티가 함께 쓰는 표현 계층.
// 필드 이름은 앞으로 생길 갤러리 구독 API 응답 형태에 맞춰 두었다 — API가 준비되면
// 목록 데이터만 서버 응답으로 바꾸면 이 컴포넌트들은 그대로 쓸 수 있다.
export type Community = {
  /** 목록 안에서의 고유 식별자. React key와 가입 상태 관리에 쓴다. */
  id: number;
  /**
   * 게시글을 읽어올 실제 백엔드 갤러리 id.
   * 갤러리 목록 API가 없어 지금은 예시 커뮤니티가 모두 같은 갤러리를 가리킨다 —
   * 없는 id를 넘기면 게시글 조회가 404(GALLERY_NOT_FOUND)로 떨어진다.
   */
  galleryId: number;
  name: string;
  memberCount: number;
  description: string;
  imageUrl: string | null;
};

export function memberLabel(memberCount: number): string {
  return `가입자 ${memberCount.toLocaleString("ko-KR")}명`;
}

// 가입됨은 체크된 상태라 어둡게, 미가입은 원래 보라색으로 돌아온다.
// 가입 상태는 CommunityMembershipProvider가 들고 있어 목록·전체목록·상세가 같은 값을 본다.
export function CommunityJoinButton({ community, block = false }: {
  community: Community;
  block?: boolean;
}) {
  const membership = useCommunityMembership();
  const joined = membership.isJoined(community.id);
  const pending = membership.isPending(community.id);
  return (
    <button
      className={`community-join ${joined ? "is-joined" : ""} ${block ? "community-join--block" : ""}`}
      aria-pressed={joined}
      aria-busy={pending}
      disabled={pending}
      aria-label={`${community.name} ${joined ? "가입됨 — 누르면 탈퇴" : "가입하기"}`}
      onClick={() => membership.toggle(community.id)}
    >
      {joined ? "가입됨" : "가입"}
    </button>
  );
}

type CardProps = {
  community: Community;
  onOpen?: (community: Community) => void;
  /** 화면의 제목 단계에 맞춘다 — 목록 위 제목이 h1이면 2, h2면 3. */
  headingLevel?: 2 | 3;
};

// 가로로 넓은 카드: 아바타 · 이름 · 가입자 수 · 가입 버튼 · 설명.
export function CommunityCard({ community, onOpen, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className="community-card">
      <div className="community-card-header">
        <Avatar src={community.imageUrl} />
        <div className="community-card-title">
          <Heading>{onOpen ? <button className="community-open" aria-label={`${community.name} 커뮤니티 열기`} onClick={() => onOpen(community)}>{community.name}</button> : community.name}</Heading>
          <p>{memberLabel(community.memberCount)}</p>
        </div>
        <CommunityJoinButton community={community} />
      </div>
      <p className="community-card-description">{community.description}</p>
    </li>
  );
}

// 가로 스크롤 레일용 좁은 세로 카드. 설명은 자리가 없어 싣지 않는다.
export function CommunityRailCard({ community, onOpen, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className="community-rail-card">
      <Avatar src={community.imageUrl} />
      <Heading>{onOpen ? <button className="community-open" aria-label={`${community.name} 커뮤니티 열기`} onClick={() => onOpen(community)}>{community.name}</button> : community.name}</Heading>
      <p>{memberLabel(community.memberCount)}</p>
      <CommunityJoinButton community={community} block />
    </li>
  );
}

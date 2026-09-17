"use client";

import { useCallback, useState } from "react";
import { Avatar } from "@/components/app/shared";

// 가입한 커뮤니티 / 추천 커뮤니티가 함께 쓰는 표현 계층.
// 필드 이름은 앞으로 생길 갤러리 구독 API 응답 형태에 맞춰 두었다 — API가 준비되면
// 목록 데이터만 서버 응답으로 바꾸면 이 컴포넌트들은 그대로 쓸 수 있다.
export type Community = {
  galleryId: number;
  name: string;
  memberCount: number;
  description: string;
  imageUrl: string | null;
};

export function memberLabel(memberCount: number): string {
  return `가입자 ${memberCount.toLocaleString("ko-KR")}명`;
}

// 가입/탈퇴 API가 아직 없어 화면 안에서만 유지되는 상태다 — 새로고침하면 초기값으로 돌아온다.
export function useCommunityMembership(initialJoinedIds: number[]) {
  const [joinedIds, setJoinedIds] = useState(() => new Set(initialJoinedIds));

  const isJoined = useCallback((galleryId: number) => joinedIds.has(galleryId), [joinedIds]);

  const toggle = useCallback((galleryId: number) => {
    setJoinedIds(previous => {
      const next = new Set(previous);
      if (!next.delete(galleryId)) next.add(galleryId);
      return next;
    });
  }, []);

  return { isJoined, toggle };
}

// 가입됨은 체크된 상태라 어둡게, 미가입은 원래 보라색으로 돌아온다.
export function CommunityJoinButton({ name, joined, onToggle, block = false }: {
  name: string;
  joined: boolean;
  onToggle: () => void;
  block?: boolean;
}) {
  return (
    <button
      className={`community-join ${joined ? "is-joined" : ""} ${block ? "community-join--block" : ""}`}
      aria-pressed={joined}
      aria-label={`${name} ${joined ? "가입됨 — 누르면 탈퇴" : "가입하기"}`}
      onClick={onToggle}
    >
      {joined ? "가입됨" : "가입"}
    </button>
  );
}

type CardProps = {
  community: Community;
  joined: boolean;
  onToggle: () => void;
  /** 화면의 제목 단계에 맞춘다 — 목록 위 제목이 h1이면 2, h2면 3. */
  headingLevel?: 2 | 3;
};

// 가로로 넓은 카드: 아바타 · 이름 · 가입자 수 · 가입 버튼 · 설명.
export function CommunityCard({ community, joined, onToggle, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className="community-card">
      <div className="community-card-header">
        <Avatar src={community.imageUrl} />
        <div className="community-card-title">
          <Heading>{community.name}</Heading>
          <p>{memberLabel(community.memberCount)}</p>
        </div>
        <CommunityJoinButton name={community.name} joined={joined} onToggle={onToggle} />
      </div>
      <p className="community-card-description">{community.description}</p>
    </li>
  );
}

// 가로 스크롤 레일용 좁은 세로 카드. 설명은 자리가 없어 싣지 않는다.
export function CommunityRailCard({ community, joined, onToggle, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className="community-rail-card">
      <Avatar src={community.imageUrl} />
      <Heading>{community.name}</Heading>
      <p>{memberLabel(community.memberCount)}</p>
      <CommunityJoinButton name={community.name} joined={joined} onToggle={onToggle} block />
    </li>
  );
}

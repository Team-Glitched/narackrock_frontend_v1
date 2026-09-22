"use client";

import { useState } from "react";
import { Avatar } from "@/components/app/shared";
import { useGalleryPosts } from "@/hooks/use-gallery-posts";
import { CommunityJoinButton, memberLabel, type Community } from "./community-card";
import { useCommunityMembership } from "./community-membership";
import { CommunityPost, PostComposer } from "./mobile-screens";
import "./community.css";

export function CommunityDetailScreen({ community, onComments }: {
  community: Community; onComments: (postId: number) => void;
}) {
  const posts = useGalleryPosts(community.galleryId);
  const membership = useCommunityMembership();
  const [composing, setComposing] = useState(false);

  return <div className="community-detail community-view scroll-content">
    <div className="community-detail-banner" aria-hidden="true" />
    <section className="community-detail-info" aria-label="커뮤니티 소개">
      <div className="community-detail-heading">
        <Avatar src={community.imageUrl} />
        <div><h1>{community.name}</h1><p>{memberLabel(community.memberCount)}</p></div>
        <CommunityJoinButton community={community} />
      </div>
      <p className="community-detail-description">{community.description}</p>
      {membership.error && <p className="membership-error" role="alert">{membership.error}</p>}
    </section>
    {composing && <div className="community-detail-composer"><PostComposer galleryId={community.galleryId} onCreated={() => { setComposing(false); posts.refetch(); }} onCancel={() => setComposing(false)} /></div>}
    {posts.status === "loading" && <p className="community-detail-status" role="status">게시글을 불러오는 중...</p>}
    {posts.status === "error" && <div className="community-detail-status" role="alert"><p>이 커뮤니티의 게시글을 불러오지 못했습니다.</p><button className="gray-pill" onClick={posts.refetch}>다시 시도</button></div>}
    {posts.status === "ready" && <>
      {posts.posts.length === 0 && <p className="community-detail-status">아직 게시글이 없어요.</p>}
      {posts.posts.map(post => <CommunityPost key={post.postId} post={post} onChanged={posts.refetch} onCompose={() => setComposing(true)} onComments={onComments} />)}
    </>}
    {!composing && <button className="community-compose purple-pill" onClick={() => setComposing(true)}>글쓰기</button>}
    {/* 갤러리 목록 API가 없어 예시 커뮤니티가 모두 같은 갤러리를 가리킨다 — 문구로 분명히 해 둔다. */}
    <p className="directory-preview-notice">커뮤니티 소개·가입자 수는 예시입니다. 게시글은 실제 서버 데이터지만, 커뮤니티별 갤러리가 아직 없어 모든 커뮤니티가 같은 갤러리를 보여줍니다. 가입 기능도 준비 중이에요.</p>
  </div>;
}

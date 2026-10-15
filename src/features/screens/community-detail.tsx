"use client";

import { GalleryPermissionProvider } from "@/features/community/admin/moderation-state";
import { ManageEntry } from "@/features/community/admin/manage-panel";
import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/app/shared";
import { useGalleries } from "@/hooks/use-galleries";
import { useGalleryPosts } from "@/hooks/use-gallery-posts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { PostSort } from "@/lib/api/contracts";
import { CommunityJoinButton, galleryToCommunity, memberLabel, type Community } from "./community-card";
import { useCommunityMembership } from "./community-membership";
import { CommunityPost, PostComposer } from "./mobile-screens";
import { PostListControls } from "./post-list-controls";
import "./community.css";

export function CommunityDetailScreen(props: { community: Community; onComments: (postId: number) => void }) {
  return <GalleryPermissionProvider galleryId={props.community.galleryId}><CommunityDetailContent {...props} /></GalleryPermissionProvider>;
}

function CommunityDetailContent({ community: selected, onComments }: {
  community: Community; onComments: (postId: number) => void;
}) {
  const membership = useCommunityMembership();
  // 목록에서 넘어올 때 받은 값은 그 시점의 스냅샷이라, 이 화면에서 가입/탈퇴하면 가입자 수가
  // 뒤처진다. 갤러리 목록을 다시 받아 같은 id를 덮어쓴다(아직 못 받았으면 넘겨받은 값으로 그린다).
  const galleries = useGalleries(membership.revision);
  const community = useMemo(() => {
    if (galleries.status !== "ready") return selected;
    const fresh = galleries.galleries.find(gallery => gallery.galleryId === selected.galleryId);
    return fresh ? galleryToCommunity(fresh) : selected;
  }, [galleries, selected]);

  const [sort, setSort] = useState<PostSort>("LATEST");
  const [keyword, setKeyword] = useState<string | null>(null);
  const posts = useGalleryPosts(community.galleryId, { sort, keyword });
  const [composing, setComposing] = useState(false);

  // 스크롤되는 것은 window가 아니라 이 요소(.scroll-content)다. 옵저버의 기준으로 넘긴다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useInfiniteScroll({
    enabled: posts.hasMore && !posts.appending && !posts.appendFailed,
    onLoadMore: posts.loadMore,
    rootRef: scrollRef,
  });

  return <div ref={scrollRef} className="community-detail community-view scroll-content">
    <div className="community-detail-banner" aria-hidden="true" />
    <ManageEntry name={community.name} description={community.description || ""} onChanged={galleries.refetch} />
    <section className="community-detail-info" aria-label="커뮤니티 소개">
      <div className="community-detail-heading">
        <Avatar src={community.imageUrl} />
        <div><h1>{community.name}</h1><p>{memberLabel(community.memberCount)}</p></div>
        <CommunityJoinButton community={community} />
      </div>
      {community.description && <p className="community-detail-description">{community.description}</p>}
      {membership.error && <div className="membership-error" role="alert">
        <span>{membership.error}</span>
        {membership.loadFailed && <button className="gray-pill compact" disabled={membership.loading} onClick={membership.retryLoad}>다시 시도</button>}
      </div>}
    </section>
    {composing && <div className="community-detail-composer"><PostComposer galleryId={community.galleryId} onCreated={() => { setComposing(false); posts.refetch(); }} onCancel={() => setComposing(false)} /></div>}
    <PostListControls sort={sort} onSortChange={setSort} keyword={keyword} onKeywordChange={setKeyword} />
    {posts.status === "loading" && <p className="community-detail-status" role="status">게시글을 불러오는 중...</p>}
    {posts.status === "error" && <div className="community-detail-status" role="alert"><p>이 커뮤니티의 게시글을 불러오지 못했습니다.</p><button className="gray-pill" onClick={posts.refetch}>다시 시도</button></div>}
    {posts.status === "ready" && <>
      {/* 검색 중이라면 "글이 없다"가 아니라 "검색 결과가 없다"로 알려야 한다 — 원인이 다르다. */}
      {posts.posts.length === 0 && <p className="community-detail-status">{keyword ? `‘${keyword}’에 해당하는 게시글이 없어요.` : "아직 게시글이 없어요."}</p>}
      {posts.posts.map(post => <CommunityPost key={post.postId} post={post} onChanged={posts.refetch} onCompose={() => setComposing(true)} onComments={onComments} />)}

      {/* 스크롤이 여기 닿으면 다음 페이지를 부른다. 보이는 요소가 아니라 감시용 표식이다. */}
      {posts.hasMore && <div ref={sentinelRef} className="post-feed-sentinel" aria-hidden="true" />}

      {/* 옵저버가 못 도는 경우와 추가 로드 실패 시 사용할 버튼. */}
      {posts.hasMore && <div className="post-feed-end" role="status" aria-live="polite">
        {posts.appendFailed && <p className="post-feed-error">게시글을 더 불러오지 못했습니다.</p>}
        <button className="gray-pill compact" disabled={posts.appending} onClick={posts.loadMore}>
          {posts.appending ? "불러오는 중..." : posts.appendFailed ? "다시 시도" : "더보기"}
        </button>
      </div>}

      {!posts.hasMore && posts.posts.length > 0 && <p className="post-feed-end-notice">마지막 게시글이에요.</p>}
    </>}

    {/* 무한 스크롤에서도 글쓰기 버튼에 접근할 수 있도록 고정한다. */}
    {!composing && <div className="community-fab-slot">
      <button className="community-fab" aria-label="글쓰기" onClick={() => setComposing(true)}>
        <span aria-hidden="true">✎</span>
      </button>
    </div>}
  </div>;
}
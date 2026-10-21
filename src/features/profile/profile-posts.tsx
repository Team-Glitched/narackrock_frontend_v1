"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiRequest } from "@/lib/api/client";
import { fetchPost } from "@/lib/api/community";
import type { ApiResponse, PostDetailResponse } from "@/lib/api/contracts";

type PostSummary = { postId: number; title: string; imageUrl: string | null; writer: { nickname: string } };

export function ProfilePostsScreen({ kind, onOpen }: { kind: "savedPosts" | "likedPosts"; onOpen: (postId: number) => void }) {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (kind === "savedPosts") {
        const result = await apiRequest<ApiResponse<{ posts: PostSummary[] }>>("/api/v1/users/me/bookmarks/posts?page=0&size=100");
        return result.data.posts;
      }
      const result = await apiRequest<ApiResponse<number[]>>("/api/v1/users/me/liked-posts");
      const details = await Promise.allSettled(result.data.slice(0, 100).map(id => fetchPost(id)));
      return details.filter((entry): entry is PromiseFulfilledResult<PostDetailResponse> => entry.status === "fulfilled").map(entry => entry.value);
    };
    load().then(items => { if (alive) setPosts(items); }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "게시글을 불러오지 못했습니다."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind]);
  return <div className="profile-posts scroll-content"><h1>{kind === "savedPosts" ? "북마크한 게시물" : "좋아요한 게시물"}</h1>
    {error && <p role="alert">{error}</p>}{loading ? <p>불러오는 중...</p> : posts.length === 0 ? <p>아직 게시물이 없습니다.</p> : posts.map(post => <button key={post.postId} className="profile-post-item" onClick={() => onOpen(post.postId)}>
      {post.imageUrl && <Image src={post.imageUrl} alt="" width={60} height={60} unoptimized />}
      <span><strong>{post.title}</strong><small>{post.writer.nickname}</small></span>
    </button>)}
  </div>;
}

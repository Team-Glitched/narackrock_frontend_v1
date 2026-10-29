import { useEffect, useMemo, useRef, useState } from "react";
import {useGalleries} from "@/hooks/use-galleries";
import {canManageCommunityMember} from "@/features/admin/permissions";
import {PostMemberModeration} from "@/features/admin/post-member-moderation";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { PostUserActionsMenu } from "@/components/app/dialog";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { ReportReasons } from "@/components/app/report-reasons";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Asset, Avatar } from "@/components/app/shared";
import { createPostComment, deletePostComment, fetchPost, fetchPostComments, recordPostView, updatePostComment } from "@/lib/api/community";
import { ApiError, getCurrentUserId } from "@/lib/api/client";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import type { PostDetailResponse } from "@/lib/api/contracts";
import "./community.css";
import "./post-comments.css";

function errorMessage(error: unknown, forbidden = "현재 계정은 댓글을 작성할 수 없습니다.") {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요하거나 만료되었습니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403) return forbidden;
    if (error.status === 404) return "게시글 또는 댓글이 삭제되었거나 존재하지 않습니다.";
    if (error.status === 400) return "댓글 내용과 입력값을 확인해주세요.";
  }
  return "불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNow(date, { addSuffix: true, locale: ko });
}
export function PostCommentsScreen({ postId, onProfile, onHidden, moderation }: { moderation?:{galleryId:number;remove:(postId:number)=>Promise<void>}; postId: number; onProfile?: (userId: number) => void; onHidden: () => void }) {
  const hiddenPosts = useHiddenPosts();
  const galleries=useGalleries(0);
  const [memberAction,setMemberAction]=useState<"suspend"|"expel"|null>(null);
  const [moderationNotice,setModerationNotice]=useState("");
  const [post, setPost] = useState<PostDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const adapter = useMemo<CommentAdapter>(()=>({
    async load(parentId,page) { const result=await fetchPostComments(postId,parentId,page);return {page:result.page,total:result.totalCount,items:result.comments.map(item=>({id:item.commentId,parentId:item.parentCommentId,userId:item.writer.userId,author:item.writer.nickname??"알 수 없는 사용자",avatarUrl:item.writer.profileImageUrl,text:item.content,time:time(item.createdAt),replyCount:item.replyCount,likes:0}))}; },
    create:(text,parentId)=>createPostComment(postId,text,parentId),update:updatePostComment,remove:deletePostComment,
  }),[postId]);
  useEffect(() => {
    let cancelled = false;
    fetchPost(postId).then(data => { if (!cancelled) { setPost(data); setError(null); } })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [postId, revision]);

  // 조회수는 **본문을 실제로 띄운 뒤에만** 기록한다.
  //
  // 화면에 들어오자마자 기록하면 상세 조회가 실패한 경우까지 집계된다. 이 화면은 인증이
  // 필수라(비로그인은 401) 로그인 전에는 본문이 뜨지 않는데, 그때도 조회수가 오르는 것을
  // 실제로 확인했다. 읽지 못한 글은 읽은 것이 아니다.
  //
  // revision(댓글 등록 후 재조회)에는 의존하지 않는다 - 같은 글을 계속 보고 있을 뿐이다.
  const loadedPostId = post?.postId;
  useEffect(() => {
    if (loadedPostId !== postId) return;
    // 조회수는 본문을 읽는 데 곁다리다. 결과를 쓰지 않고 실패해도 화면에 에러를 띄우지 않는다.
    void recordPostView(postId).catch(() => {});
  }, [postId, loadedPostId]);

  const [menu,setMenu]=useState(false);
  const optionButton=useRef<HTMLButtonElement>(null);
  const [report,setReport]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const moderationCommunity=post&&galleries.status==="ready"?galleries.galleries.find(gallery=>gallery.galleryId===post.gallery.galleryId):undefined;
  const canModerateMember=post&&moderationCommunity&&canManageCommunityMember(moderationCommunity,getCurrentUserId(),post.writer.userId);
  const canModerate=post&&moderation?.galleryId===post.gallery.galleryId;
  async function removePost() {
    if(!canModerate||!moderation)return;
    setDeleting(true);
    try {await moderation.remove(postId);onHidden();} catch(cause) {setError(cause instanceof Error?cause.message:"삭제하지 못했습니다.");setDeleting(false);setConfirmDelete(false);}
  }
  const [focus,setFocus] = useState(0);
  return <div className="comments-screen community-view"><CommonComments canWrite={post!==null&&!deleting} adapter={adapter} currentUserId={getCurrentUserId()} onProfile={onProfile} onCreated={()=>setRevision(value=>value+1)} focus={focus} header={<>
    {error && <div role="alert"><p>{error}</p>{!post&&<button className="gray-pill compact" onClick={()=>{setError(null);setRevision(value=>value+1);}}>다시 시도</button>}</div>}
    {!post && !error && <p role="status">게시글을 불러오는 중...</p>}
    {post&&moderationCommunity&&memberAction&&<PostMemberModeration community={moderationCommunity} member={post.writer} action={memberAction} onClose={()=>setMemberAction(null)} onDone={message=>{setMemberAction(null);setModerationNotice(message);}}/>}
    {moderationNotice&&<p className="post-moderation-notice" role="status">{moderationNotice}</p>}
    {post && <>
        <article className="community-post comments-post">
          <div className="community-author"><button className="post-author-link" aria-label={`${post.writer.nickname} 프로필`} onClick={() => onProfile?.(post.writer.userId)}><Avatar src={post.writer.profileImageUrl} /><strong>{post.writer.nickname || "알 수 없는 사용자"}</strong></button><span>• {time(post.createdAt)}</span><button ref={optionButton} aria-label="게시글 더보기" aria-expanded={menu} onClick={()=>setMenu(value=>!value)}><Asset name="post-more.svg"/></button></div>
          {menu&&<PostUserActionsMenu onSuspendMember={canModerateMember?()=>{setMenu(false);setMemberAction("suspend");}:undefined} onExpelMember={canModerateMember?()=>{setMenu(false);setMemberAction("expel");}:undefined} anchorRef={optionButton} onModerateDelete={canModerate?()=>{setMenu(false);setConfirmDelete(true);}:undefined} onClose={()=>setMenu(false)} onReport={()=>{setMenu(false);setReport(true);}} onHide={()=>{hiddenPosts.hide(postId);onHidden();}}/>}
          {confirmDelete&&<div className="post-delete-confirm" role="group" aria-label="게시글 삭제 확인"><p>이 게시글을 삭제할까요?</p><button className="gray-pill" disabled={deleting} onClick={()=>setConfirmDelete(false)}>취소</button><button className="purple-pill" disabled={deleting} onClick={removePost}>{deleting?"삭제 중...":"삭제 확인"}</button></div>}
          <h2>{post.title}</h2>{post.content && <p className="comments-post-content">{post.content}</p>}
          {post.imageUrl && <img className="community-image" src={post.imageUrl} alt="게시글 첨부 이미지" width={350} height={262} />}
          <div className="community-actions">
            <div className="community-vote"><button disabled aria-label="게시글 좋아요 준비 중"><Asset name="post-like-off.svg" />{post.likeCount}</button><span className="community-vote-divider" /><button disabled aria-label="게시글 싫어요 준비 중"><Asset name="post-dislike-off.svg" /></button></div>
            <button aria-label={`댓글 ${post.commentCount}개로 이동`} onClick={() => setFocus(value=>value+1)}><Asset name="post-comment.svg" />{post.commentCount}</button><i />
            <button disabled aria-label="공유 준비 중"><Asset name="post-share.svg" /></button><button disabled aria-label="북마크 준비 중"><Asset name="post-save-off.svg" /></button>
          </div>
        </article><div className="nr-post-comment-divider" /></>}
  </>} />{report&&<FigmaSheet title="신고" onClose={()=>setReport(false)}><ReportReasons/></FigmaSheet>}</div>;
}

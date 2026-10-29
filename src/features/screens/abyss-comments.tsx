import { useMemo } from "react";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { CommonComments } from "@/features/comments/common-comments";
import { localCommentAdapter, sampleComments } from "@/features/comments/comment-model";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { getCurrentUserId } from "@/lib/api/client";
import type { Navigate } from "@/features/navigation/types";
export function AbyssComments({open,onClose,go,commentCount,shortId=1,onCreated}:{open:boolean;onClose:()=>void;go:Navigate;commentCount?:number;shortId?:number;onCreated?:()=>void}) {
  const preview=isPreviewMode();
  const me=getCurrentUserId();
  const adapter=useMemo(()=>localCommentAdapter(`abyss:${shortId}`,preview&&commentCount!==0?sampleComments([2,12,1,0]):[],{id:me??1,name:"나",avatar:"/figma/profile.png"}),[shortId,preview,me,commentCount]);
  if(!open)return null;
  return <FigmaSheet title="댓글" onClose={onClose}><CommonComments adapter={adapter} currentUserId={me} canWrite={preview} onCreated={onCreated} onProfile={id=>{onClose();go("profile",id);}} /></FigmaSheet>;
}

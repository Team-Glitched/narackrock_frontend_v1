"use client";
import { useSyncExternalStore } from "react";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { savedSourcesSnapshot, subscribeSavedSources, type SavedSource } from "./saved-sources";
const empty:SavedSource[]=[];
export function useSavedSources(){
  const userId=useCurrentUserId();
  const scope=`${isPreviewMode()?"preview":"live"}.${userId??"guest"}`;
  const items=useSyncExternalStore(subscribeSavedSources,()=>savedSourcesSnapshot(scope),()=>empty);
  return {scope,items};
}

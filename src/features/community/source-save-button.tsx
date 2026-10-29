import { useState } from "react";
import type { PreviewSource } from "@/features/preview/source-store";
import { sourceAudioFile } from "@/features/preview/source-store";
import { useSavedSources } from "./use-saved-sources";
import { toggleSavedSource } from "./saved-sources";
export function useSourceSave(source:PreviewSource|undefined){
  const {scope,items}=useSavedSources();const saved=Boolean(source&&items.some(item=>item.id===source.id));
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function toggle(){if(!source||busy)return;setBusy(true);setError("");try{await toggleSavedSource(scope,source,sourceAudioFile(source.id));}catch{setError("저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.");}finally{setBusy(false);}}
  return {saved,busy,error,toggle};
}

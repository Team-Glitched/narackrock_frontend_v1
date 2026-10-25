import type { MidiNoteDto } from "../../lib/api/composition.ts";
import { readBrowserRecord, writeBrowserRecord, deleteBrowserRecord } from "../../lib/browser/records.ts";
type FileIdentity={name:string;size:number;lastModified:number};
type AttachmentIdentity={image:FileIdentity|null;audio:FileIdentity|null};
const identify=(file:File|null):FileIdentity|null=>file?{name:file.name,size:file.size,lastModified:file.lastModified}:null;
const matches=(file:File|null|undefined,identity:FileIdentity|null)=>Boolean(file&&identity&&file.name===identity.name&&file.size===identity.size&&file.lastModified===identity.lastModified);
export type CreationDraft={title:string;content:string;image:File|null;audio:File|null;notes:MidiNoteDto[];bpm:number};
const drafts=new Map<string,CreationDraft>();
const fileWrites=new Map<string,{image:File|null;audio:File|null;promise:Promise<void>}>();
const storageKey=(key:string)=>`narackrock.creation-draft.${key}`;
export function readCreationDraft(key:string):(CreationDraft&{attachments?:AttachmentIdentity})|undefined{
  if(drafts.has(key))return drafts.get(key);
  if(typeof localStorage==="undefined")return undefined;
  try{
    const value=JSON.parse(localStorage.getItem(storageKey(key))??"null");
    if(!value||typeof value.title!=="string"||typeof value.content!=="string"||!Array.isArray(value.notes)||!Number.isFinite(value.bpm))return undefined;
    return {...value,image:null,audio:null};
  }catch{return undefined;}
}
export async function restoreCreationDraft(key:string){
  if(drafts.has(key))return drafts.get(key);
  const text=readCreationDraft(key);if(!text)return undefined;
  const noAttachments=text.attachments&&!text.attachments.image&&!text.attachments.audio;
  const files=noAttachments?undefined:await readBrowserRecord<{image:File|null;audio:File|null}>(storageKey(key));
  const expected=text.attachments;
  const image=expected?(matches(files?.image,expected.image)?files!.image:null):(files?.image??null);
  const audio=expected?(matches(files?.audio,expected.audio)?files!.audio:null):(files?.audio??null);
  const missing=Boolean(expected&&((expected.image&&!image)||(expected.audio&&!audio)));
  const draft={...text,image,audio,restorationWarning:missing?"일부 첨부 파일을 복원하지 못했습니다. 다시 첨부해주세요.":undefined};drafts.set(key,draft);fileWrites.set(key,{image:draft.image,audio:draft.audio,promise:Promise.resolve()});return draft;
}
export function rememberCreationDraft(key:string,draft:CreationDraft):Promise<void>{
  drafts.set(key,draft);
  if(typeof localStorage!=="undefined"){
    try{localStorage.setItem(storageKey(key),JSON.stringify({title:draft.title,content:draft.content,notes:draft.notes,bpm:draft.bpm,attachments:{image:identify(draft.image),audio:identify(draft.audio)}}));}
    catch{return Promise.reject(new Error("초안을 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요."));}
  }
  if(typeof indexedDB==="undefined"&&typeof window==="undefined")return Promise.resolve();
  const previous=fileWrites.get(key);
  if(previous?.image===draft.image&&previous?.audio===draft.audio)return previous.promise;
  const promise=!previous&&!draft.image&&!draft.audio?Promise.resolve():writeBrowserRecord(storageKey(key),{image:draft.image,audio:draft.audio});
  const entry={image:draft.image,audio:draft.audio,promise};fileWrites.set(key,entry);
  void promise.catch(()=>{if(fileWrites.get(key)===entry)fileWrites.delete(key);});
  return promise;
}
export function clearCreationDraft(key:string){
  drafts.delete(key);fileWrites.delete(key);
  if(typeof localStorage!=="undefined")localStorage.removeItem(storageKey(key));
  if(typeof indexedDB!=="undefined")void deleteBrowserRecord(storageKey(key)).catch(()=>{});
}

export type PreviewSource={id:number;title:string;description:string;author:string;userId:number;mediaUrl:string|null;imageUrl:string|null;usageCount?:number;likeCount?:number;dislikeCount?:number;commentCount?:number};
let sources:PreviewSource[]=[{id:1,usageCount:123123,likeCount:5,dislikeCount:5,commentCount:5,title:"개쩌는 파트",description:"제가 만들다 보니까 쫌 개쩔게 나와서 한번 올려봅니당",author:"min chong",userId:2,mediaUrl:null,imageUrl:null}];
const audioFiles=new Map<number,File>();
export const sourceAudioFile=(id:number)=>audioFiles.get(id)??null;
const listeners=new Set<()=>void>();
export const subscribeSources=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const sourceSnapshot=()=>sources;
export function createPreviewSource(title:string,description:string,file:File,imageUrl:string|null){const source={id:Date.now(),usageCount:0,likeCount:0,dislikeCount:0,commentCount:0,title:title.trim(),description:description.trim(),author:"나",userId:1,mediaUrl:URL.createObjectURL(file),imageUrl};audioFiles.set(source.id,file);sources=[source,...sources];listeners.forEach(listener=>listener());return source;}

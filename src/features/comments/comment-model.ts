export type CommentItem = {
  id: number; parentId: number | null; userId: number; author: string;
  avatarUrl: string | null; text: string; time: string; replyCount: number; likes: number;
};
export type CommentPage = { items: CommentItem[]; total: number; page: number };
export type CommentAdapter = {
  load: (parentId: number | null, page: number) => Promise<CommentPage>;
  create: (text: string, parentId: number | null) => Promise<unknown>;
  update: (id: number, text: string) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
};
const stores = new Map<string, CommentItem[]>();
let nextId = 100000;
export function localCommentAdapter(scope: string, initial: CommentItem[], own: {id: number; name: string; avatar: string | null}): CommentAdapter {
  if (!stores.has(scope)) stores.set(scope, initial.map(item => ({...item})));
  const list = () => stores.get(scope)!;
  const owned = (id: number) => { const item = list().find(item => item.id === id); if (!item || item.userId !== own.id) throw new Error("본인이 작성한 댓글만 변경할 수 있습니다."); return item; };
  return {
    async load(parentId, page) {
      const matching = list().filter(item => item.parentId === parentId);
      return {items: matching.slice(page * 10, (page + 1) * 10).map(item => ({...item, replyCount:list().filter(reply => reply.parentId === item.id).length})), total: matching.length, page};
    },
    async create(text, parentId) {
      if (!text.trim()) throw new Error("댓글 내용을 입력해주세요.");
      if (parentId !== null && !list().some(item => item.id === parentId && item.parentId === null)) throw new Error("답글을 달 댓글을 찾을 수 없습니다.");
      list().push({id:++nextId,parentId,userId:own.id,author:own.name,avatarUrl:own.avatar,text:text.trim(),time:"방금",replyCount:0,likes:0});
    },
    async update(id, text) { if (!text.trim()) throw new Error("댓글 내용을 입력해주세요."); owned(id).text = text.trim(); },
    async remove(id) { owned(id); stores.set(scope,list().filter(item => item.id !== id && item.parentId !== id)); },
  };
}
export function sampleComments(replyCounts: number[]): CommentItem[] {
  let id = 1;
  const result: CommentItem[] = [];
  for (const count of replyCounts) {
    const parent = id++;
    const item = {userId:2,author:"min chong",avatarUrl:"/figma/profile.png",text:"이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고",time:"1초 전",likes:116};
    result.push({...item,id:parent,parentId:null,replyCount:count});
    for(let i=0;i<count;i++) result.push({...item,id:id++,parentId:parent,replyCount:0});
  }
  return result;
}

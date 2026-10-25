import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localCommentAdapter, sampleComments } from './comment-model.ts';
const own={id:1,name:'나',avatar:null};
test('reply pages retain their parent and a created reply updates the root count',async()=>{
 const adapter=localCommentAdapter('test:reply',sampleComments([12,1]),own);
 const root=(await adapter.load(null,0)).items[0];
 assert.equal((await adapter.load(root.id,0)).items.length,10);
 assert.equal((await adapter.load(root.id,1)).items.length,2);
 await adapter.create('새 답글',root.id);
 assert.equal((await adapter.load(null,0)).items[0].replyCount,13);
 assert.equal((await adapter.load(root.id,1)).items.at(-1)?.text,'새 답글');
 await assert.rejects(adapter.create('잘못된 중첩',2));
});
test('comments remain isolated by entity and only their writer can edit or remove',async()=>{
 const first=localCommentAdapter('test:entity-a',sampleComments([1]),own);
 const second=localCommentAdapter('test:entity-b',[],own);
 await first.create('내 댓글',null);
 const mine=(await first.load(null,0)).items.at(-1)!;
 await first.update(mine.id,'수정');
 assert.equal((await first.load(null,0)).items.at(-1)?.text,'수정');
 assert.equal((await second.load(null,0)).total,0);
 await assert.rejects(first.update(1,'타인 수정'));
 await assert.rejects(first.remove(1));
 await first.create('내 답글',mine.id);
 await first.remove(mine.id);
 assert.equal((await first.load(mine.id,0)).total,0);
});

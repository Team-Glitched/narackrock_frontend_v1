import test from "node:test";
import assert from "node:assert/strict";
import {rememberCreationDraft,readCreationDraft,clearCreationDraft} from "../../features/community/creation-draft.ts";
test("drafts retain attachments across screen navigation and are isolated by user and form",()=>{
 const image=new File(["image"],"cover.png",{type:"image/png"});
 const draft={title:"작성 중",content:"본문",image,audio:null,notes:[],bpm:120};
 rememberCreationDraft("live:1:post",draft);
 assert.equal(readCreationDraft("live:1:post").image,image);
 assert.equal(readCreationDraft("live:2:post"),undefined);
 assert.equal(readCreationDraft("live:1:source"),undefined);
 clearCreationDraft("live:1:post");
 assert.equal(readCreationDraft("live:1:post"),undefined);
});

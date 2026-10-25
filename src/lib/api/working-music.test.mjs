import test from "node:test";
import assert from "node:assert/strict";
import {workingMusic} from "../../features/workspace/working-music.ts";
function work(id,{status="DRAFT",canEdit=true,canContribute=true,ownerId=1,approval="DRAFT",date="2026-10-25T01:00:00Z"}={}){return {id,updatedAt:date,composition:{project:{status},viewerPermission:{userId:1,canEdit,canContribute},tracks:[{ownerId,clips:[{approvalStatus:approval}]}]}};}
test("home promotes recently edited drafts without mutating stored order",()=>{
 const works=[work(1),work(2,{date:"2026-10-25T02:00:00Z"})];
 assert.deepEqual(workingMusic(works).map(item=>item.id),[2,1]);
 assert.deepEqual(works.map(item=>item.id),[1,2]);
});
test("home only offers music the viewer can continue",()=>{
 const works=[work(1,{canEdit:false,canContribute:false}),work(2,{status:"PUBLISHED",approval:"APPROVED"}),work(3,{status:"PUBLISHED",canEdit:false}),work(4,{canEdit:false,ownerId:2})];
 assert.deepEqual(workingMusic(works).map(item=>item.id),[3]);
 assert.deepEqual(workingMusic([]),[]);
});

import test from "node:test";
import assert from "node:assert/strict";
import {isCommunityOwner,canManageCommunityMember} from "../../features/admin/permissions.ts";
import {previewRequest,getPreviewCommunityMembers,moderatePreviewCommunityMember,moderatePreviewCommunityPost,createPreviewCommunity} from "../../features/preview/demo-api.ts";

test("community management requires known ownership and never targets the creator",()=>{
  assert.equal(isCommunityOwner({},1),false);
  assert.equal(isCommunityOwner({ownerId:1},null),false);
  assert.equal(isCommunityOwner({ownerId:1},2),false);
  assert.equal(isCommunityOwner({ownerId:1},1),true);
  assert.equal(canManageCommunityMember({ownerId:1},1,1),false);
  assert.equal(canManageCommunityMember({ownerId:1},1,2),true);
});
test("preview sanctions stay in their community and require a reason",()=>{
  const other=createPreviewCommunity("관리 범위 확인","",null);
  assert.throws(()=>getPreviewCommunityMembers(1,2));
  assert.throws(()=>moderatePreviewCommunityMember(1,1,1,"expel","owner"));
  assert.throws(()=>moderatePreviewCommunityMember(1,1,2,"suspend","  "));
  assert.throws(()=>moderatePreviewCommunityMember(other.galleryId,1,2,"expel","cross community"));
  for(const days of [0,-1,1.5,366,NaN])assert.throws(()=>moderatePreviewCommunityMember(1,1,2,"suspend","사유",days),/기간/);
  const started=Date.now();
  moderatePreviewCommunityMember(1,1,2,"suspend","미리보기 테스트",7);
  const member=getPreviewCommunityMembers(1,1).find(member=>member.userId===2);
  assert.ok(Date.parse(member.suspendedUntil)>=started+7*86400000);
  assert.ok(Date.parse(member.suspendedUntil)<=Date.now()+7*86400000);
  assert.equal(member.reason,"미리보기 테스트");
  moderatePreviewCommunityMember(1,1,2,"expel","미리보기 테스트");
  assert.ok(!getPreviewCommunityMembers(1,1).some(member=>member.userId===2));
  assert.equal(getPreviewCommunityMembers(other.galleryId,1).length,1);
});
test("moderated deletion rejects nonowners and cross-community posts",async()=>{
  const get=async path=>(await previewRequest(path)).data;
  assert.throws(()=>moderatePreviewCommunityPost(1,2,1));
  assert.throws(()=>moderatePreviewCommunityPost(2,2,1));
  const before=await get("/api/v1/galleries/1/posts");
  moderatePreviewCommunityPost(1,1,1);
  const after=await get("/api/v1/galleries/1/posts");
  assert.equal(after.posts.length,before.posts.length-1);
  await assert.rejects(()=>previewRequest("/api/v1/posts/1"));
});

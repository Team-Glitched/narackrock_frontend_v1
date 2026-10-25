import test from "node:test";
import assert from "node:assert/strict";
import {searchCommunityPosts} from "../../features/community/post-search.ts";
import {previewRequest} from "../../features/preview/demo-api.ts";

const data=async(path,init)=>(await previewRequest(path,init)).data;

test("same-keyword posts from another community never enter community search",async()=>{
  const keyword="커뮤니티 검색 범위 확인";
  const create=galleryId=>data(`/api/v1/galleries/${galleryId}/posts`,{method:"POST",body:JSON.stringify({title:keyword,content:"검색 확인"})});
  const first=await create(1),second=await create(2);
  const calls=[];
  const fetchPosts=async(galleryId,query)=>{
    calls.push(galleryId);
    return data(`/api/v1/galleries/${galleryId}/posts?keyword=${encodeURIComponent(query.keyword)}&size=${query.size}&page=${query.page}`);
  };
  const firstResults=await searchCommunityPosts(fetchPosts,1,` ${keyword} `);
  assert.ok(firstResults.some(post=>post.postId===first.postId));
  assert.ok(!firstResults.some(post=>post.postId===second.postId));
  assert.deepEqual(calls,[1]);
  calls.length=0;
  const secondResults=await searchCommunityPosts(fetchPosts,2,keyword);
  assert.ok(secondResults.some(post=>post.postId===second.postId));
  assert.ok(!secondResults.some(post=>post.postId===first.postId));
  assert.deepEqual(calls,[2]);
  calls.length=0;
  assert.deepEqual(await searchCommunityPosts(fetchPosts,3,keyword),[]);
  assert.deepEqual(calls,[3]);
});
test("blank searches do not fetch and mismatched gallery responses are rejected",async()=>{
  assert.deepEqual(await searchCommunityPosts(()=>{throw new Error("must not fetch");},1,"  "),[]);
  await assert.rejects(()=>searchCommunityPosts(async()=>({galleryId:2,posts:[]}),1,"검색"),/커뮤니티 검색 결과/);
});

test("search includes later pages without duplicate posts or endless repeat pages",async()=>{
  const calls=[];
  const rows=Array.from({length:205},(_,index)=>({postId:index+1}));
  const result=await searchCommunityPosts(async(galleryId,{page,size})=>{
    calls.push(page);return {galleryId,totalCount:rows.length,posts:rows.slice(page*size,(page+1)*size)};
  },1,"검색");
  assert.equal(result.length,205);
  assert.deepEqual(calls,[0,1,2]);
  let repeated=0;
  const repeatedResult=await searchCommunityPosts(async galleryId=>{repeated++;return {galleryId,totalCount:1000,posts:[{postId:1}]};},1,"검색");
  assert.equal(repeatedResult.length,1);
  assert.equal(repeated,2);
});

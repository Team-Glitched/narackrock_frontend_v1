import assert from "node:assert/strict";
import test from "node:test";
import {recommendByAuthor,popularSources} from "../../features/community/discovery.ts";
test("recommendation excludes own work and gives different authors first positions",()=>{
 const items=[{id:1,author:1},{id:2,author:2},{id:3,author:2},{id:4,author:3},{id:5,author:3}];
 assert.deepEqual(recommendByAuthor(items,item=>item.author,1).map(item=>item.id),[2,4,3,5]);
 assert.deepEqual(items.map(item=>item.id),[1,2,3,4,5]);
 assert.deepEqual(recommendByAuthor([items[0]],item=>item.author,1),[items[0]]);
 assert.deepEqual(recommendByAuthor([],item=>item.author,null),[]);
});
test("source chart ranks usage count without changing recommendation feed order",()=>{
 const items=[{id:1,usageCount:5},{id:2},{id:3,usageCount:20},{id:4,usageCount:5}];
 assert.deepEqual(popularSources(items).map(item=>item.id),[3,4,1,2]);
 assert.deepEqual(items.map(item=>item.id),[1,2,3,4]);
});

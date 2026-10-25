import test from "node:test";
import assert from "node:assert/strict";
import {NavigationHistory} from "../../features/navigation/browser-history.ts";
function port(){const entries=[{framework:"retained"}];let index=0;return {get state(){return entries[index];},replaceState(value){entries[index]=structuredClone(value);},pushState(value){entries.splice(index+1);entries.push(structuredClone(value));index++;},back(){return entries[--index];},forward(){return entries[++index];},get length(){return entries.length;}};}
const valid=value=>Boolean(value)&&typeof value.view==="string"&&typeof value.query==="string";
test("browser navigation keeps drafts/search context without keystroke history entries",()=>{
 const history=port(),controller=new NavigationHistory(history,valid);
 controller.initialize({view:"home",query:""},"home");
 assert.equal(controller.canGoBack(),false);
 controller.sync({view:"search",query:""},"search");
 controller.sync({view:"search",query:"피아노"},"search");
 controller.sync({view:"post",query:"피아노",postId:5},"post:5");
 assert.equal(history.length,3);
 assert.equal(controller.canGoBack(),true);
 const restored=controller.restore(history.back());
 assert.deepEqual(restored,{view:"search",query:"피아노"});
 controller.sync({view:"post",query:"피아노",postId:5},"post:5"); // stale pre-restore render
 controller.sync(restored,"search");
 assert.equal(history.length,3);
 assert.equal(history.state.framework,"retained");
 assert.equal(controller.restore(history.forward()).postId,5);
});
test("refresh restores the current screen and a new branch drops obsolete forward entries",()=>{
 const history=port(),first=new NavigationHistory(history,valid);
 first.initialize({view:"home",query:""},"home");first.sync({view:"createPost",query:""},"createPost");
 const refreshed=new NavigationHistory(history,valid);
 assert.equal(refreshed.initialize({view:"home",query:""},"home").view,"createPost");
 refreshed.sync({view:"createPost",query:""},"createPost");
 const home=refreshed.restore(history.back());refreshed.sync(home,"home");
 refreshed.sync({view:"settings",query:""},"settings");
 assert.equal(history.length,2);assert.equal(history.state.narackrockNavigation.data.view,"settings");
 assert.equal(refreshed.restore({narackrockNavigation:{version:99,key:"other",data:{view:"home",query:""}}}),null);
});
test("logical back replaces the current workflow page instead of adding another back entry",()=>{
 const history=port(),controller=new NavigationHistory(history,valid);
 controller.initialize({view:"settings",query:""},"settings");
 controller.sync({view:"edit",query:""},"edit");
 controller.replaceNext();controller.sync({view:"settings",query:""},"settings");
 assert.equal(history.length,2);
 assert.equal(history.state.narackrockNavigation.data.view,"settings");
 controller.sync({view:"search",query:""},"search");assert.equal(history.length,3);
});

import assert from "node:assert/strict";
import test from "node:test";
import {canMoveClip, overlapsClip, snappedClipStart} from "./timeline-move.ts";

test("clip movement snaps to grid and stays within the song",()=>{
  assert.equal(snappedClipStart(480,29,240,3840,960),720);
  assert.equal(snappedClipStart(480,31,240,3840,960),960);
  assert.equal(snappedClipStart(480,-Infinity,240,3840,960),0);
  assert.equal(snappedClipStart(480,Infinity,240,3840,960),2880);
  assert.equal(snappedClipStart(480,Infinity,240,3900,1000),2880);
});
test("clip edges can touch but clips in the same layer cannot overlap",()=>{
  const clip={clipId:1,durationTick:480};
  const siblings=[{clipId:1,startTick:0,durationTick:480},{clipId:2,startTick:960,durationTick:480}];
  assert.equal(overlapsClip(clip,0,siblings),false);
  assert.equal(overlapsClip(clip,480,siblings),false);
  assert.equal(overlapsClip(clip,720,siblings),true);
  assert.equal(overlapsClip(clip,1440,siblings),false);
});
test("only an editable owner or a contributor's own draft can move",()=>{
  const viewer={userId:1,canEdit:false,canContribute:true,canReviewContribution:false,canExport:false};
  assert.equal(canMoveClip(viewer,{ownerId:1,approvalStatus:"DRAFT"}),true);
  assert.equal(canMoveClip(viewer,{ownerId:1,approvalStatus:"APPROVED"}),false);
  assert.equal(canMoveClip({...viewer,canEdit:true},{ownerId:2,approvalStatus:"DRAFT"}),false);
  assert.equal(canMoveClip({...viewer,canEdit:true},{ownerId:1,approvalStatus:"APPROVED"}),true);
  assert.equal(canMoveClip({...viewer,canContribute:false},{ownerId:1,approvalStatus:"DRAFT"}),false);
});

test("nonstandard beat grid uses the same spacing for drag and snap",()=>{
  const cellPx=80/3,stepTick=960/3;
  assert.equal(snappedClipStart(0,cellPx,stepTick,57600,960,cellPx),320);
  assert.equal(snappedClipStart(0,cellPx*2,stepTick,57600,960,cellPx),640);
});

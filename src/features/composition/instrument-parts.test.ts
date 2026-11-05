import assert from "node:assert/strict";
import test from "node:test";
import { instruments } from "./instrument-catalog.ts";
import { instrumentGroups, partFamily, partLabel, supportsMidi, occupyingTrack } from "./instrument-parts.ts";

test("every sampled tone has exactly one instrument family", () => {
  for(const instrument of instruments) assert.equal(instrumentGroups.filter(group=>group.instruments.includes(instrument.id)).length,1,instrument.id);
});
test("variants share a family while acoustic and electric guitars stay separate", () => {
  assert.equal(partFamily("piano"),partFamily("electric-piano"));
  assert.equal(partFamily("electric-guitar"),partFamily("distortion-guitar"));
  assert.notEqual(partFamily("acoustic-guitar"),partFamily("electric-guitar"));
  assert.equal(partFamily("GUITAR"),partFamily("nylon-guitar"));
  assert.equal(partFamily("vocal"),partFamily("backing-vocal"));
  assert.equal(partFamily("DRUMS"),partFamily("percussion"));
});
test("recorded vocal roles retain their labels and never become a piano", () => {
  assert.equal(partLabel("vocal"),"메인 보컬"); assert.equal(partLabel(null),"악기 선택");
  assert.equal(partLabel("legacy-custom"),"legacy-custom");
  assert.equal(supportsMidi("vocal"),false); assert.equal(supportsMidi("PIANO"),true);
});
test("a teammate reserves the entire family, excluding the current track and rejected tracks", () => {
  const tracks=[{trackId:1,instrument:"electric-guitar",approvalStatus:"PENDING",name:"기타"}];
  assert.equal(occupyingTrack(tracks,"distortion-guitar")?.trackId,1);
  assert.equal(occupyingTrack(tracks,"acoustic-guitar"),undefined);
  assert.equal(occupyingTrack(tracks,"overdrive-guitar",1),undefined);
  assert.equal(occupyingTrack([{...tracks[0],approvalStatus:"REJECTED"}],"overdrive-guitar"),undefined);
});

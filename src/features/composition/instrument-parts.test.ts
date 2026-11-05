import assert from "node:assert/strict";
import test from "node:test";
import { instruments } from "./instrument-catalog.ts";
import { instrumentGroups, partFamily, partLabel, supportsMidi, tracksUsingInstrumentFamily } from "./instrument-parts.ts";

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
test("shared instrument families list all other active layers for information", () => {
  const tracks = [
    { trackId: 1, instrument: "electric-guitar", approvalStatus: "PENDING", name: "리듬 기타" },
    { trackId: 2, instrument: "distortion-guitar", approvalStatus: "APPROVED", name: "리드 기타" },
    { trackId: 3, instrument: "overdrive-guitar", approvalStatus: "REJECTED", name: "반려 기타" },
  ];
  assert.deepEqual(tracksUsingInstrumentFamily(tracks, "overdrive-guitar").map(track => track.trackId), [1, 2]);
  assert.deepEqual(tracksUsingInstrumentFamily(tracks, "electric-guitar", 1).map(track => track.trackId), [2]);
  assert.deepEqual(tracksUsingInstrumentFamily(tracks, "acoustic-guitar"), []);
  assert.deepEqual(tracksUsingInstrumentFamily(tracks, "unknown"), []);
});
test("duet vocals and chorus share the same usage group", () => {
  const tracks = [
    { trackId: 1, instrument: "vocal", approvalStatus: "DRAFT", name: "보컬 1" },
    { trackId: 2, instrument: "backing-vocal", approvalStatus: "APPROVED", name: "코러스" },
  ];
  assert.deepEqual(tracksUsingInstrumentFamily(tracks, "vocal").map(track => track.trackId), [1, 2]);
});

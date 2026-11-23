import assert from "node:assert/strict";
import test from "node:test";
import { instruments } from "./instrument-catalog.ts";
import {
  formatProfileInstruments,
  instrumentGroups,
  instrumentParts,
  partFamily,
  partIdForValue,
  partLabel,
  parseProfileInstruments,
  profileInstrumentLabels,
  supportsMidi,
  tracksUsingInstrumentFamily,
} from "./instrument-parts.ts";
import { INSTRUMENT_MAX_LENGTH, codePointLength } from "../../lib/content-limits.ts";

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

test("profile instrument parsing normalizes enums, Korean aliases, and comma-separated multi-select values", () => {
  assert.equal(partIdForValue("ELECTRIC_GUITAR"), "electric-guitar");
  assert.equal(partIdForValue("VOCAL"), "vocal");
  assert.equal(partIdForValue("BACKING_VOCAL"), "backing-vocal");
  assert.equal(partIdForValue("보컬"), "vocal");
  assert.equal(partIdForValue("일렉기타"), "electric-guitar");
  assert.equal(partIdForValue("통기타"), "acoustic-guitar");

  const parsed = parseProfileInstruments("PIANO, 보컬, acoustic_guitar, custom-synth, VOCAL");
  assert.deepEqual(parsed.selectedIds, ["piano", "vocal", "acoustic-guitar"]);
  assert.deepEqual(parsed.customLabels, ["custom-synth"]);
  assert.equal(
    formatProfileInstruments(parsed.selectedIds, parsed.customLabels),
    "피아노, 메인 보컬, 어쿠스틱 기타, custom-synth",
  );
  assert.deepEqual(
    profileInstrumentLabels("ELECTRIC_GUITAR, backing-vocal"),
    ["클린 일렉 기타", "코러스"],
  );

  // All 29 instrument labels fit cleanly inside INSTRUMENT_MAX_LENGTH (250)
  const allFormatted = formatProfileInstruments(instrumentParts.map((part) => part.id));
  assert.ok(codePointLength(allFormatted) <= INSTRUMENT_MAX_LENGTH);
  assert.equal(allFormatted.split(", ").length, instrumentParts.length);
});

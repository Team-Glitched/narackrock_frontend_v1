import test from "node:test";
import assert from "node:assert/strict";
import { allDrumPads, basicDrumPads, drumPitches, drumPadFor, moveDrumNotes } from "./drum-kit.ts";
import { NoteEditorSession } from "./note-editor.ts";
import type { MidiNoteDto } from "../../lib/api/composition.ts";
const note = (pitch: number): MidiNoteDto => ({pitch,startTick:0,durationTick:120,velocity:100,effectType:null,effectParams:{}});

test("full kit covers each MIDI percussion pitch once with a named pad", () => {
  assert.deepEqual(allDrumPads.map((pad) => pad.pitch), Array.from({length:47},(_, i) => 81-i));
  assert.equal(new Set(allDrumPads.map((pad) => pad.pitch)).size,47);
  assert.equal(drumPadFor(39)?.label,"핸드 클랩");
  assert.equal(drumPadFor(34),undefined);
  assert.deepEqual(basicDrumPads.map((pad) => pad.pitch),[49,57,53,51,50,47,41,46,42,38,36]);
});
test("row moves follow visible kit order rather than chromatic pitch", () => {
  const moved = moveDrumNotes([note(49)],new Set([0]),0,1,drumPitches(false),{maxTick:960,minPitch:35,maxPitch:81});
  assert.equal(moved[0].pitch,57);
});
test("hidden drum notes survive view changes and block ambiguous row moves", () => {
  let commits=0;
  const source=[note(39)];
  const session=new NoteEditorSession({contextKey:'drums',notes:source,ppq:480,signature:{numerator:4,denominator:4},instrument:'drum-kit',bounds:{maxTick:3840,minPitch:35,maxPitch:81},editable:true,onCommit:()=>{commits++;return true;}});
  session.selectAll();
  assert.equal(session.execute({type:'move',indices:[0],deltaTick:0,deltaRow:1}),false);
  assert.equal(commits,0);
  assert.match(session.getSnapshot().error ?? '',/전체/);
  session.setExpandedDrums(true);
  assert.deepEqual(session.getSnapshot().history.present.notes,source);
  assert.equal(session.execute({type:'move',indices:[0],deltaTick:0,deltaRow:1}),true);
  assert.equal(session.getSnapshot().history.present.notes[0].pitch,38);
  session.undo();
  session.setExpandedDrums(false);
  assert.equal(session.getSnapshot().history.present.notes[0].pitch,39);
});

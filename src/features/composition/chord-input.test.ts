import assert from "node:assert/strict";
import test from "node:test";
import { chordPitches, chordStartTick, insertChord } from "./chord-input.ts";
import type { MidiNoteDto } from "../../lib/api/composition.ts";

const placement = { rootPitch: 60, quality: "major" as const, startTick: 480, durationTick: 960, maxTick: 3840 };

test("C, Cm7 and Csus4 expand into simultaneous notes with the selected length", () => {
  assert.deepEqual(chordPitches(60, "major"), [60, 64, 67]);
  assert.deepEqual(chordPitches(60, "m7"), [60, 63, 67, 70]);
  assert.deepEqual(chordPitches(60, "sus4"), [60, 65, 67]);
  const result = insertChord([], placement);
  assert.equal(result.reason, null);
  assert.deepEqual(result.notes.map(({ pitch, startTick, durationTick, velocity }) =>
    ({ pitch, startTick, durationTick, velocity })), [60, 64, 67].map((pitch) =>
    ({ pitch, startTick: 480, durationTick: 960, velocity: 100 })));
});

test("all twelve roots transpose across octaves, including sharps and extended chords", () => {
  for (let root = 48; root < 60; root++) {
    assert.deepEqual(chordPitches(root, "major"), [root, root + 4, root + 7]);
    assert.deepEqual(chordPitches(root, "minor"), [root, root + 3, root + 7]);
    assert.deepEqual(chordPitches(root, "m7"), [root, root + 3, root + 7, root + 10]);
    assert.deepEqual(chordPitches(root, "7"), [root, root + 4, root + 7, root + 10]);
    assert.deepEqual(chordPitches(root, "maj7"), [root, root + 4, root + 7, root + 11]);
    assert.deepEqual(chordPitches(root, "sus2"), [root, root + 2, root + 7]);
    assert.deepEqual(chordPitches(root, "sus4"), [root, root + 5, root + 7]);
    assert.deepEqual(chordPitches(root, "dim"), [root, root + 3, root + 6]);
    assert.deepEqual(chordPitches(root, "aug"), [root, root + 4, root + 8]);
    assert.deepEqual(chordPitches(root, "m7b5"), [root, root + 3, root + 6, root + 10]);
    assert.deepEqual(chordPitches(root, "dim7"), [root, root + 3, root + 6, root + 9]);
    assert.deepEqual(chordPitches(root, "add9"), [root, root + 4, root + 7, root + 14]);
  }
  assert.deepEqual(chordPitches(71, "m7"), [71, 74, 78, 81]);
});

test("chord placement snaps the project playhead to the clip's local grid", () => {
  const timeline = { bpm: 120, ppq: 480, stepTick: 240, clipStartTick: 960 };
  assert.equal(chordStartTick(1625, timeline), 480);
  assert.equal(chordStartTick(1000, timeline), 0);
  assert.equal(chordStartTick(0, timeline), 0);
  assert.equal(chordStartTick(2000, { ...timeline, clipStartTick: 1000 }), 720);
  assert.equal(chordStartTick(1000, { bpm: 90, ppq: 960, stepTick: 480, clipStartTick: 0 }), 1440);
});

test("notes stop at the project boundary and no chord is added beyond it", () => {
  const result = insertChord([], { ...placement, startTick: 3600 });
  assert.ok(result.notes.every((note) => note.durationTick === 240));
  for (const startTick of [3840, 4080, -240]) {
    assert.equal(insertChord([], { ...placement, startTick }).reason, "outside-timeline");
  }
  assert.equal(insertChord([], { ...placement, durationTick: 0 }).reason, "outside-timeline");
});

test("out of range pitches reject the entire chord instead of dropping chord tones", () => {
  assert.deepEqual(chordPitches(120, "major"), [120, 124, 127]);
  assert.deepEqual(chordPitches(121, "major"), []);
  for (const rootPitch of [-1, 128, 60.5]) {
    assert.equal(insertChord([], { ...placement, rootPitch }).reason, "outside-pitch-range");
  }
});

test("overlap and repeated clicks preserve existing notes without inserting a partial chord", () => {
  const original: MidiNoteDto[] = [{ pitch: 64, startTick: 240, durationTick: 480,
    velocity: 80, effectType: "REVERB", effectParams: { mix: 0.2 } }];
  const result = insertChord(original, placement);
  assert.equal(result.reason, "overlap");
  assert.equal(result.notes, original);
  assert.deepEqual(original[0].effectParams, { mix: 0.2 });
  const chord = insertChord([], placement).notes;
  assert.equal(insertChord(chord, placement).notes, chord);
  assert.equal(insertChord(chord, placement).reason, "overlap");
});

test("adjacent notes and notes at other pitches can coexist with the chord", () => {
  const original: MidiNoteDto[] = [
    { pitch: 60, startTick: 0, durationTick: 480, velocity: 80, effectType: null, effectParams: {} },
    { pitch: 64, startTick: 1440, durationTick: 240, velocity: 90, effectType: null, effectParams: {} },
    { pitch: 72, startTick: 480, durationTick: 960, velocity: 70, effectType: null, effectParams: {} },
  ];
  const result = insertChord(original, placement);
  assert.equal(result.reason, null);
  assert.equal(result.notes.length, 6);
  assert.deepEqual(result.notes.slice(0, 3), original);
  assert.equal(original.length, 3);
});

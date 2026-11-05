import test from "node:test";
import assert from "node:assert/strict";
import { chordPitches, chordQualities, chordRoots, chordStartTick, insertChord } from "./chord-input.ts";
import { applyNoteEdit } from "./note-editing.ts";

const placement = { rootPitch: 60, quality: "major" as const, startTick: 480, durationTick: 960, maxTick: 3840 };

test("all twelve harmonic qualities transpose every root without changing their interval relationships", () => {
  assert.equal(chordRoots.length, 12);
  assert.equal(chordQualities.length, 12);
  assert.deepEqual(chordPitches(60, "major"), [60, 64, 67]);
  assert.deepEqual(chordPitches(60, "minor"), [60, 63, 67]);
  assert.deepEqual(chordPitches(60, "dim7"), [60, 63, 66, 69]);
  assert.deepEqual(chordPitches(60, "m7b5"), [60, 63, 66, 70]);
  assert.deepEqual(chordPitches(60, "add9"), [60, 64, 67, 74]);
  for (const quality of chordQualities) {
    for (let root = 48; root < 60; root++) {
      assert.deepEqual(chordPitches(root + 12, quality.id), chordPitches(root, quality.id).map((pitch) => pitch + 12));
      assert.equal(chordPitches(root, quality.id).length, quality.intervals.length);
    }
  }
});

test("clip-local snapping corrects floating clock noise while preserving genuine floor behavior", () => {
  for (const bpm of [90, 110, 120, 140]) {
    for (const ppq of [96, 480, 960]) {
      for (const clipStartTick of [0, 960, 1000]) {
        const timeline = { bpm, ppq, stepTick: ppq / 2, clipStartTick };
        for (const cell of [0, 1, 6, 65]) {
          const toMs = (tick: number) => tick * 60000 / (bpm * ppq);
          assert.equal(chordStartTick(toMs(clipStartTick + cell * timeline.stepTick), timeline), cell * timeline.stepTick);
          if (cell > 0) {
            assert.equal(chordStartTick(toMs(clipStartTick + (cell - 1e-8) * timeline.stepTick), timeline), (cell - 1) * timeline.stepTick);
          }
          assert.equal(chordStartTick(toMs(clipStartTick + (cell + 0.25) * timeline.stepTick), timeline), cell * timeline.stepTick);
        }
        assert.equal(chordStartTick(0, timeline), 0);
      }
    }
  }
});

test("accumulated seeks at BPM90 remain on the sixth boundary instead of falsely colliding", () => {
  let positionMs = 0;
  for (let i = 0; i < 6; i++) positionMs += 60000 / 180;
  const startTick = chordStartTick(positionMs, { bpm: 90, ppq: 480, stepTick: 240, clipStartTick: 0 });
  assert.equal(startTick, 1440);
  const prior = insertChord([], { ...placement, startTick: 1200, durationTick: 240 }).notes;
  const result = insertChord(prior, { ...placement, startTick });
  assert.equal(result.reason, null);
  assert.equal(result.notes.length, 6);
  assert.strictEqual(result.notes[0], prior[0]);
});

test("positive remaining time trims all chord tones equally; no insertion occurs at or beyond the end", () => {
  const result = insertChord([], { ...placement, startTick: 3600 });
  assert.equal(result.reason, null);
  assert.deepEqual(result.notes.map((note) => [note.pitch, note.startTick, note.durationTick, note.velocity]),
    [60, 64, 67].map((pitch) => [pitch, 3600, 240, 100]));
  for (const startTick of [-240, 3840, 4080, 0.5])
    assert.equal(insertChord([], { ...placement, startTick }).reason, "outside-timeline");
  assert.equal(insertChord([], { ...placement, durationTick: 0 }).reason, "outside-timeline");
});

test("out-of-range tones reject the entire chord and repeated insertions preserve the original", () => {
  assert.deepEqual(chordPitches(120, "major"), [120, 124, 127]);
  for (const rootPitch of [-1, 121, 128, 60.5])
    assert.equal(insertChord([], { ...placement, rootPitch }).reason, "outside-pitch-range");
  const original = insertChord([], placement).notes;
  const duplicate = insertChord(original, placement);
  assert.equal(duplicate.reason, "overlap");
  assert.strictEqual(duplicate.notes, original);
  assert.equal(insertChord(original, { ...placement, startTick: 1440 }).reason, null);
});

test("a whole chord enters the real command path as one atomic selected batch", () => {
  const chord = insertChord([], placement);
  const result = applyNoteEdit({ notes: [], selected: [] }, { type: "insert", notes: chord.notes }, {
    maxTick: 3840, minPitch: 0, maxPitch: 127, stepTick: 240,
    rows: Array.from({ length: 128 }, (_, row) => 127 - row),
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.snapshot.selected, [0, 1, 2]);
  assert.deepEqual(result.snapshot.notes.map((note) => note.pitch), [60, 64, 67]);
  const rejected = applyNoteEdit(result.snapshot, { type: "insert", notes: chord.notes }, {
    maxTick: 3840, minPitch: 0, maxPitch: 127, stepTick: 240, rows: [],
  });
  assert.equal(rejected.changed, false);
  assert.strictEqual(rejected.snapshot, result.snapshot);
});

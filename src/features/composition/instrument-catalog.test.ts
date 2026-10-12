import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { instrumentFor, instruments, samplePitches, sampleUrls } from "./instrument-catalog.ts";

test("offers a complete band palette and falls back for legacy piano tracks", () => {
  for (const id of ["piano", "drum-kit", "acoustic-guitar", "electric-guitar",
    "electric-bass", "synth-lead", "synth-pad"]) {
    assert.equal(instrumentFor(id).id, id);
  }
  assert.equal(instrumentFor("PIANO").id, "piano");
  assert.equal(instrumentFor("피아노").id, "piano");
  assert.equal(instrumentFor(null).id, "piano");
  assert.equal(new Set(instruments.map((item) => item.id)).size, instruments.length);
});

test("every catalog note has a browser sample", () => {
  for (const instrument of instruments) {
    const pitches = samplePitches(instrument);
    assert.ok(pitches.length >= 5, instrument.id);
    for (const pitch of pitches) {
      assert.ok(existsSync(new URL(`../../../public/audio/instruments/${instrument.id}/${pitch}.mp3`, import.meta.url)),
        `${instrument.id}/${pitch}`);
      assert.equal(sampleUrls(instrument)[pitch], `${pitch}.mp3`);
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { sheetSnap } from "./sheet-snap.ts";

const frame = 844; // half 422, near-half band 337.6–506.4

test("released well below the middle, the sheet closes", () => {
  assert.equal(sheetSnap(0, frame), "closed");
  assert.equal(sheetSnap(300, frame), "closed");
});

test("released near the middle, the sheet rests at half height", () => {
  assert.equal(sheetSnap(340, frame), "half");
  assert.equal(sheetSnap(422, frame), "half");
  assert.equal(sheetSnap(506, frame), "half");
});

test("released above the middle band, the sheet returns to full height", () => {
  assert.equal(sheetSnap(507, frame), "full");
  assert.equal(sheetSnap(721, frame), "full");
});

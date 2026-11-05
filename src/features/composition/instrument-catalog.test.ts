import assert from "node:assert/strict";
import test from "node:test";
import { findInstrument, invalidPitchesFor } from "./instrument-catalog.ts";

test("legacy names resolve to the backend ids while unknown instruments are not replaced with piano", () => {
  assert.equal(findInstrument("PIANO")?.id, "piano");
  assert.equal(findInstrument("드럼")?.id, "drum-kit");
  assert.equal(findInstrument("vocal"), undefined);
  assert.equal(findInstrument(null), undefined);
  assert.equal(findInstrument("theremin"), undefined);
});

test("drum kits reject notes outside General MIDI percussion 35–81", () => {
  const drums = findInstrument("drum-kit")!;
  assert.deepEqual(invalidPitchesFor(drums, [34, 35, 60, 81, 82]), [34, 82]);
  assert.deepEqual(invalidPitchesFor(findInstrument("piano")!, [10, 120]), []);
});

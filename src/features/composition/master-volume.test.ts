import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studioScreen = readFileSync(
  new URL("../screens/studio-screens.tsx", import.meta.url),
  "utf8",
);
const playback = readFileSync(
  new URL("./use-composition-playback.ts", import.meta.url),
  "utf8",
);

test("uses the toolbar slider as the composition master volume", () => {
  assert.match(studioScreen, /aria-label="마스터 볼륨"/);
  assert.match(studioScreen, /volume=\{playback\.volume\}/);
  assert.match(studioScreen, /onVolume=\{playback\.setVolume\}/);
  assert.doesNotMatch(studioScreen, /className="studio-seek"/);
  assert.doesNotMatch(studioScreen, /aria-label="재생 위치"/);
});

test("applies the master volume to MIDI and audio layers", () => {
  assert.match(playback, /gain\.connect\(masterGain\)/);
  assert.match(playback, /sustain\.connect\(sustainGain\)\.connect\(masterGain\)/);
  assert.match(playback, /audio\.volume = volume \* volumeRef\.current \/ 100/);
  assert.match(playback, /audioRef\.current\.forEach/);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { CompositionDto, TrackDto, ClipDto } from "../../lib/api/composition.ts";
import { compositionDurationMs } from "./playback-duration.ts";

const clip: ClipDto = {
  clipId: 1,
  ownerId: 1,
  clipType: "MIDI",
  sourceType: "PIANO_ROLL",
  mediaFileId: null,
  mediaUrl: null,
  startTick: 480,
  durationTick: 960,
  startTimeMs: 0,
  durationMs: 0,
  clipOffsetMs: 0,
  approvalStatus: "APPROVED",
  midiNotes: [
    {
      pitch: 60,
      startTick: 240,
      durationTick: 480,
      velocity: 100,
      effectType: null,
      effectParams: {},
    },
  ],
};
const track: TrackDto = {
  trackId: 1,
  ownerId: 1,
  name: "피아노",
  instrument: "piano",
  volume: 100,
  isMuted: false,
  isSolo: false,
  approvalStatus: "APPROVED",
  clips: [clip],
};
function composition(tracks: TrackDto[], maxDurationMs = 120000): CompositionDto {
  return {
    viewerPermission: {
      userId: 1,
      canEdit: true,
      canContribute: true,
      canReviewContribution: true,
      canExport: true,
    },
    project: {
      projectId: 1,
      title: "곡",
      albumImageFileId: null,
      bpm: 120,
      ppq: 480,
      maxTick: 115200,
      maxDurationMs,
      status: "DRAFT",
      isPublic: false,
      version: { major: 1, minor: 0, display: "1.0" },
    },
    tracks,
  };
}
test("MIDI preview ends at the last audible note including clip offset", () => {
  assert.equal(compositionDurationMs(composition([track])), 1250);
});
test("audio preview includes its start time and respects the project limit", () => {
  const audio = {
    ...track,
    clips: [
      {
        ...clip,
        clipType: "AUDIO" as const,
        startTimeMs: 3000,
        durationMs: 8000,
        clipOffsetMs: 2000,
      },
    ],
  };
  assert.equal(compositionDurationMs(composition([audio])), 11000);
  assert.equal(compositionDurationMs(composition([audio], 5000)), 5000);
});
test("muted tracks and tracks excluded by solo do not extend playback", () => {
  const silent = { ...track, trackId: 2, isMuted: true, clips: [{ ...clip, startTick: 48000 }] };
  assert.equal(compositionDurationMs(composition([track, silent])), 1250);
  assert.equal(
    compositionDurationMs(
      composition([
        { ...track, isSolo: true },
        { ...silent, isMuted: false },
      ]),
    ),
    1250,
  );
  assert.equal(compositionDurationMs(composition([])), 0);
  assert.equal(
    compositionDurationMs(composition([{ ...track, clips: [{ ...clip, midiNotes: [] }] }])),
    0,
  );
});

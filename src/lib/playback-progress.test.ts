import test from "node:test";
import assert from "node:assert/strict";
import {
  anchoredPositionMs,
  keyboardSeekMs,
  nextPlaybackAnchor,
  PLAYBACK_MAX_AHEAD_MS,
  playbackAnchorSettled,
  reportedPositionMs,
} from "./playback-progress.ts";

test("reports a stepped position only while the audio advances", () => {
  assert.equal(reportedPositionMs(1234.5, true), 1000);
  assert.equal(reportedPositionMs(1234.5, false), 1234.5);
});

test("extrapolates an advancing report up to the cap and settles there", () => {
  const anchor = nextPlaybackAnchor(null, 1000, true, 0);
  assert.equal(anchoredPositionMs(anchor, 120), 1120);
  assert.equal(playbackAnchorSettled(anchor, 120, null), false);
  assert.equal(anchoredPositionMs(anchor, 5000), 1000 + PLAYBACK_MAX_AHEAD_MS);
  assert.equal(playbackAnchorSettled(anchor, PLAYBACK_MAX_AHEAD_MS, null), true);
  assert.equal(playbackAnchorSettled(anchor, 100, 1050), true);
});

test("holds the display for a report slightly behind it instead of rewinding", () => {
  const first = nextPlaybackAnchor(null, 1000, true, 0);
  // Displayed 1300 when a late report of 1250 arrives.
  const late = nextPlaybackAnchor(first, 1250, true, 300);
  assert.equal(anchoredPositionMs(late, 300), 1300);
  assert.equal(anchoredPositionMs(late, 340), 1300);
  assert.equal(anchoredPositionMs(late, 400), 1350);
});

test("resuming from an exact paused position does not step back to the rounded report", () => {
  const paused = nextPlaybackAnchor(null, 1234, false, 0);
  assert.equal(anchoredPositionMs(paused, 900), 1234);
  const resumed = nextPlaybackAnchor(paused, reportedPositionMs(1234, true), true, 1000);
  assert.equal(anchoredPositionMs(resumed, 1000), 1234);
  assert.equal(anchoredPositionMs(resumed, 1300), 1300);
});

test("shows seeks, pauses and stops exactly", () => {
  const playing = nextPlaybackAnchor(null, 5000, true, 0);
  const seeked = nextPlaybackAnchor(playing, 1000, true, 200);
  assert.equal(anchoredPositionMs(seeked, 200), 1000);
  const paused = nextPlaybackAnchor(seeked, 1180.5, false, 400);
  assert.equal(anchoredPositionMs(paused, 400), 1180.5);
  assert.equal(playbackAnchorSettled(paused, 400, null), true);
});

test("arrow keys seek 100 ms within the clip; other keys keep the input's behavior", () => {
  assert.equal(keyboardSeekMs("ArrowRight", 1234, 60_000), 1334);
  assert.equal(keyboardSeekMs("ArrowUp", 1234, 60_000), 1334);
  assert.equal(keyboardSeekMs("ArrowLeft", 1234, 60_000), 1134);
  assert.equal(keyboardSeekMs("ArrowDown", 50, 60_000), 0);
  assert.equal(keyboardSeekMs("ArrowRight", 59_950, 60_000), 60_000);
  assert.equal(keyboardSeekMs("Home", 1234, 60_000), null);
  assert.equal(keyboardSeekMs("PageUp", 1234, 60_000), null);
});

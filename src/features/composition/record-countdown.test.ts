import assert from "node:assert/strict";
import test from "node:test";
import {
  RECORD_COUNTDOWN_START,
  RECORD_START_FAILED,
  countdownBeatMs,
  countdownCaption,
  nativeCountInBlocker,
  startRecorderAfterCountIn,
} from "./record-countdown.ts";

test("record countdown uses 3 beats synced to project BPM and time signature", () => {
  assert.equal(RECORD_COUNTDOWN_START, 3);
  assert.equal(countdownBeatMs(120, "4/4"), 500);
  assert.ok(Math.abs(countdownBeatMs(90, "3/4") - 60000 / 90) < 0.01);
  assert.equal(countdownBeatMs(120, "6/8"), 250);
});

test("count-in caption announces beats remaining, not seconds", () => {
  assert.equal(countdownCaption(3), "녹음 시작까지 3박");
  assert.doesNotMatch(countdownCaption(1), /초/);
});

function fakeStream({ active = true, readyState = "live" } = {}) {
  const track = { readyState, stopped: false, stop() { this.stopped = true; } };
  return { stream: { active, getTracks: () => [track] } as unknown as MediaStream, track };
}

test("web count-in start failure releases the microphone and reports an error", () => {
  const { stream, track } = fakeStream();
  const error = startRecorderAfterCountIn({ start: () => { throw new DOMException("gone", "InvalidStateError"); } }, stream);
  assert.equal(error, RECORD_START_FAILED);
  assert.equal(track.stopped, true);
});

test("web count-in does not start on a microphone that ended during the count-in", () => {
  let started = false;
  const { stream, track } = fakeStream({ readyState: "ended" });
  assert.equal(startRecorderAfterCountIn({ start: () => { started = true; } }, stream), RECORD_START_FAILED);
  assert.equal(started, false);
  assert.equal(track.stopped, true);
});

test("web count-in starts the recorder on a live stream", () => {
  let started = false;
  const { stream, track } = fakeStream();
  assert.equal(startRecorderAfterCountIn({ start: () => { started = true; } }, stream), null);
  assert.equal(started, true);
  assert.equal(track.stopped, false);
});

test("app count-in rechecks screen, foreground and permission before starting", async () => {
  const gate = (screen: boolean, app: boolean, granted: boolean | Error) => ({
    screenActive: () => screen,
    appActive: () => app,
    microphoneGranted: () => (granted instanceof Error ? Promise.reject(granted) : Promise.resolve(granted)),
  });
  assert.equal(await nativeCountInBlocker(gate(true, true, true)), null);
  assert.equal(await nativeCountInBlocker(gate(false, true, true)), "");
  assert.equal(await nativeCountInBlocker(gate(true, false, true)), "");
  assert.equal(await nativeCountInBlocker(gate(true, true, false)), "마이크 권한을 확인해 주세요.");
  assert.equal(await nativeCountInBlocker(gate(true, true, new Error("bridge"))), "마이크 권한을 확인해 주세요.");

  // Backgrounded while the permission check was in flight.
  let foreground = true;
  const pending = nativeCountInBlocker({
    screenActive: () => true,
    appActive: () => foreground,
    microphoneGranted: async () => {
      foreground = false;
      return true;
    },
  });
  assert.equal(await pending, "");
});
